from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from datetime import date, timedelta
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.utils.auth import verify_firebase_token
from app.models.schedule import StudySchedule, DailyCheckin
from app.services.schedule_service import generate_study_plan, generate_daily_mcqs

router = APIRouter(
    prefix="/api/schedules",
    tags=["Schedules"]
)

class PlanGenerateInput(BaseModel):
    event_name: str
    event_date: date
    event_type: str # exam, interview, general
    additional_notes: Optional[str] = ""
    syllabus: str
    days: int
    daily_hours: int

class ScheduleSaveInput(BaseModel):
    title: str
    event_name: str
    event_date: date
    syllabus_content: str
    start_date: date
    end_date: date
    daily_hours: int
    schedule_json: List[dict]

class CheckinSubmitInput(BaseModel):
    schedule_id: str
    answers: dict # { question_id: "A" }

@router.post("/generate")
async def api_generate_plan(
    input_data: PlanGenerateInput,
    user_id: str = Depends(verify_firebase_token)
):
    try:
        plan = await generate_study_plan(
            input_data.syllabus, 
            input_data.days, 
            input_data.daily_hours,
            input_data.event_name,
            input_data.event_date,
            input_data.event_type,
            input_data.additional_notes
        )
        return plan
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save")
async def api_save_schedule(
    input_data: ScheduleSaveInput,
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    # We removed archiving active schedules to allow multiple overlapping schedules.
    new_schedule = StudySchedule(
        user_id=user_id,
        title=input_data.title,
        event_name=input_data.event_name,
        event_date=input_data.event_date,
        syllabus_content=input_data.syllabus_content,
        start_date=input_data.start_date,
        end_date=input_data.end_date,
        daily_hours=input_data.daily_hours,
        schedule_json=input_data.schedule_json,
        status="active"
    )
    db.add(new_schedule)
    await db.commit()
    await db.refresh(new_schedule)
    return {"id": new_schedule.id, "status": "success"}

@router.get("/active")
async def api_get_active_schedule(
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    query = select(StudySchedule).where(
        and_(StudySchedule.user_id == user_id, StudySchedule.status == "active")
    )
    result = await db.execute(query)
    # Using .first() instead of .scalar_one_or_none() to avoid MultipleResultsFound
    schedule = result.scalars().first()
    
    if not schedule:
        return {"active": False}
    
    return {
        "active": True,
        "id": schedule.id,
        "title": schedule.title,
        "start_date": schedule.start_date,
        "end_date": schedule.end_date,
        "schedule": schedule.schedule_json
    }

@router.get("/active/all")
async def api_get_all_active_schedules(
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    query = select(StudySchedule).where(
        and_(StudySchedule.user_id == user_id, StudySchedule.status == "active")
    )
    result = await db.execute(query)
    schedules = result.scalars().all()
    
    return [{
        "id": s.id,
        "title": s.title,
        "start_date": s.start_date,
        "end_date": s.end_date,
        "event_type": s.event_type if hasattr(s, 'event_type') else 'general',
        "schedule": s.schedule_json
    } for s in schedules]

@router.get("/today")
async def api_get_today_tasks(
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    # Aggregate today's tasks from all active schedules
    query = select(StudySchedule).where(
        and_(StudySchedule.user_id == user_id, StudySchedule.status == "active")
    )
    result = await db.execute(query)
    schedules = result.scalars().all()
    
    today = date.today()
    all_today_tasks = []
    
    for schedule in schedules:
        passed_days = (today - schedule.start_date).days + 1
        today_plan = next((d for d in schedule.schedule_json if d.get("day") == passed_days), None)
        if today_plan:
            all_today_tasks.append({
                "schedule_id": schedule.id,
                "schedule_title": schedule.title,
                "event_type": schedule.event_type if hasattr(schedule, 'event_type') else 'general',
                "topic": today_plan.get("topic", ""),
                "tasks": today_plan.get("tasks", []),
                "priority": today_plan.get("priority", "medium")
            })
            
    return {"today_tasks": all_today_tasks}

@router.get("/checkin/today")
async def api_get_today_checkin(
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    # 1. Find active schedules
    query = select(StudySchedule).where(
        and_(StudySchedule.user_id == user_id, StudySchedule.status == "active")
    )
    result = await db.execute(query)
    schedules = result.scalars().all()
    
    if not schedules:
        return {"status": "no_plan_for_today"}

    # Pick the primary schedule (e.g. the first one) to anchor the DailyCheckin record
    schedule = schedules[0]
    
    # 2. Check if check-in already exists for today
    today = date.today()
    checkin_query = select(DailyCheckin).where(
        and_(DailyCheckin.schedule_id == schedule.id, DailyCheckin.date == today)
    )
    checkin_result = await db.execute(checkin_query)
    existing_checkin = checkin_result.scalar_one_or_none()

    if existing_checkin:
        return existing_checkin

    # 3. If not, aggregate today's tasks from all active schedules
    aggregated_topics = []
    for s in schedules:
        passed_days = (today - s.start_date).days + 1
        today_plan = next((d for d in s.schedule_json if d.get("day") == passed_days), None)
        if today_plan:
            aggregated_topics.append(today_plan.get("topic", "") + " " + (", ".join(today_plan.get("tasks", []))))
    
    if not aggregated_topics:
        return {"status": "no_plan_for_today"}

    topics = " | ".join(aggregated_topics)
    
    try:
        mcqs = await generate_daily_mcqs(topics)
        new_checkin = DailyCheckin(
            schedule_id=schedule.id,
            user_id=user_id,
            date=today,
            mcq_json=mcqs["questions"],
            is_completed=0
        )
        db.add(new_checkin)
        await db.commit()
        await db.refresh(new_checkin)
        return new_checkin
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate check-in MCQs: {str(e)}")

@router.post("/checkin/submit")
async def api_submit_checkin(
    input_data: CheckinSubmitInput,
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    query = select(DailyCheckin).where(
        and_(
            DailyCheckin.id == input_data.schedule_id, # wait, name mismatch in input, checkin_id is better
            DailyCheckin.user_id == user_id
        )
    )
    # Actually, input_data has schedule_id, we need checkin_id from client or find today's
    # Let's assume input_data.schedule_id IS the checkin_id for now or change the pydantic
    
    # Correction: Use dedicated checkin_id or find today's
    result = await db.execute(query)
    checkin = result.scalar_one_or_none()
    
    if not checkin:
         raise HTTPException(status_code=404, detail="Check-in not found")

    # Evaluate results
    questions = checkin.mcq_json
    score = 0
    results = []
    
    for q in questions:
        q_id = str(q.get("id")) # check format from generator
        u_ans = input_data.answers.get(q_id)
        is_correct = u_ans == q.get("correct_answer")
        if is_correct: score += 1
        results.append({
            "id": q_id,
            "is_correct": is_correct,
            "user_answer": u_ans,
            "correct_answer": q.get("correct_answer")
        })

    checkin.results_json = {"score": score, "total": len(questions), "breakdown": results}
    checkin.is_completed = 1
    await db.commit()
    
    return {"status": "success", "score": score, "total": len(questions)}

# Need specific fix for the checkin lookup as schedule_id vs checkin_id
class CheckinSubmitBetterInput(BaseModel):
    checkin_id: str
    answers: dict

@router.post("/checkin/complete")
async def api_complete_checkin(
    input_data: CheckinSubmitBetterInput,
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    query = select(DailyCheckin).where(
        DailyCheckin.id == input_data.checkin_id
    )
    result = await db.execute(query)
    checkin = result.scalar_one_or_none()
    
    if not checkin or checkin.user_id != user_id:
         raise HTTPException(status_code=404, detail="Check-in session not found")

    # Evaluate results
    questions = checkin.mcq_json
    score = 0
    results = []
    
    for q in questions:
        q_id = str(q.get("id"))
        u_ans = input_data.answers.get(q_id)
        is_correct = u_ans == q.get("correct_answer")
        if is_correct: score += 1
        results.append({
            "id": q_id,
            "is_correct": is_correct,
            "user_answer": u_ans,
            "correct_answer": q.get("correct_answer")
        })

    checkin.results_json = {"score": score, "total": len(questions), "breakdown": results}
    checkin.is_completed = 1
    await db.commit()
    
    return {"status": "success", "score": score, "total": len(questions)}

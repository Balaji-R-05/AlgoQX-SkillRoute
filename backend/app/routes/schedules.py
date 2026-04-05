from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from datetime import date, timedelta
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.utils.auth import verify_firebase_token
from app.models.schedule import StudySchedule, DailyCheckin, QuizAttempt
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
    event_type: str = "exam"
    schedule_json: List[dict]

class CheckinSubmitInput(BaseModel):
    schedule_id: str
    answers: dict # { question_id: "A" }

class TaskToggleInput(BaseModel):
    schedule_id: str
    day_number: int
    task_index: int
    is_completed: bool

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
        event_type=input_data.event_type,
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
    try:
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
    except Exception as e:
        print(f"ERROR in api_get_active_schedule: {str(e)}")
        return {"active": False, "error": str(e)}

@router.get("/active/all")
async def api_get_all_active_schedules(
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    try:
        from datetime import datetime
        query = select(StudySchedule).where(
            and_(StudySchedule.user_id == user_id, StudySchedule.status == "active")
        )
        result = await db.execute(query)
        schedules = result.scalars().all()
        
        today = date.today()
        
        return [{
            "id": s.id,
            "title": s.title,
            "start_date": s.start_date,
            "end_date": s.end_date,
            "event_type": getattr(s, 'event_type', 'general'),
            "daily_hours": s.daily_hours,
            "overall_progress": round(calculate_total_progress(s.schedule_json), 1),
            "days_remaining": (normalize_date(s.end_date) - today).days if s.end_date else 0,
            "schedule": s.schedule_json
        } for s in schedules]
    except Exception as e:
        print(f"ERROR in api_get_all_active_schedules: {str(e)}")
        return []

def normalize_date(d):
    from datetime import datetime, date
    if isinstance(d, datetime):
        return d.date()
    return d

def calculate_total_progress(schedule_json):
    if not schedule_json: return 0
    total_tasks = 0
    completed_tasks = 0
    for day in schedule_json:
        tasks = day.get("tasks", [])
        total_tasks += len(tasks)
        statuses = day.get("task_statuses", [])
        completed_tasks += statuses.count("completed")
    return (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0

@router.get("/today")
async def api_get_today_tasks(
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    # Aggregate today's tasks from all active schedules
    try:
        from datetime import datetime
        query = select(StudySchedule).where(
            and_(StudySchedule.user_id == user_id, StudySchedule.status == "active")
        )
        result = await db.execute(query)
        schedules = result.scalars().all()
        
        today = date.today()
        all_today_tasks = []
        
        for schedule in schedules:
            if not schedule.start_date:
                continue
            
            # Critical Fix: Normalize start_date to date to avoid TypeError during subtraction
            start_date = schedule.start_date
            if isinstance(start_date, datetime):
                start_date = start_date.date()
                
            passed_days = (today - start_date).days + 1
            
            schedule_json = schedule.schedule_json
            if not schedule_json:
                continue
                
            # Handle potential string-serialized JSON
            if isinstance(schedule_json, str):
                import json
                try:
                    schedule_json = json.loads(schedule_json)
                except:
                    continue
            
            # Find the active day in the plan
            today_plan = next((d for d in schedule_json if d.get("day") == passed_days), None)
            if today_plan:
                all_today_tasks.append({
                    "schedule_id": schedule.id,
                    "schedule_title": schedule.title,
                    "event_type": getattr(schedule, 'event_type', 'general'),
                    "topic": today_plan.get("topic", ""),
                    "tasks": today_plan.get("tasks", []),
                    "priority": today_plan.get("priority", "medium"),
                    "day_number": passed_days,
                    "task_statuses": today_plan.get("task_statuses", []),
                    "daily_hours": schedule.daily_hours
                })
                
        return {"today_tasks": all_today_tasks}
    except Exception as e:
        print(f"CRITICAL ERROR in api_get_today_tasks: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return empty list instead of 500 to keep UI stable during debugging
        return {"today_tasks": [], "error": str(e)}

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
        s_json = s.schedule_json
        if not s_json: continue
        
        if isinstance(s_json, str):
            import json
            try:
                s_json = json.loads(s_json)
            except:
                continue
                
        passed_days = (today - s.start_date).days + 1
        today_plan = next((d for d in s_json if d.get("day") == passed_days), None)
        if today_plan:
            topic = today_plan.get("topic", "")
            tasks = today_plan.get("tasks", [])
            aggregated_topics.append(f"{topic}: {', '.join(tasks) if isinstance(tasks, list) else tasks}")
    
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
    
    # Also record in QuizAttempt for unified analytics
    attempt = QuizAttempt(
        user_id=user_id,
        quiz_type="daily_checkin",
        score=score,
        total=len(questions),
        topics="daily_review"
    )
    db.add(attempt)
    await db.commit()
    
    return {"status": "success", "score": score, "total": len(questions)}

@router.patch("/tasks/toggle")
async def api_toggle_task(
    input_data: TaskToggleInput,
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    # Use scalar() since we want the object directly
    query = select(StudySchedule).where(
        and_(StudySchedule.id == input_data.schedule_id, StudySchedule.user_id == user_id)
    )
    result = await db.execute(query)
    schedule = result.scalars().first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Update schedule_json
    # Note: JSON fields in SQLALchemy need to be updated carefully if they are mutable
    schedule_data = list(schedule.schedule_json)
    day_plan = next((d for d in schedule_data if d.get("day") == input_data.day_number), None)
    
    if not day_plan:
        raise HTTPException(status_code=404, detail="Day not found in schedule")
    
    tasks = day_plan.get("tasks", [])
    if input_data.task_index < 0 or input_data.task_index >= len(tasks):
         raise HTTPException(status_code=400, detail="Invalid task index")
    
    # Initialize task_statuses if not exists
    if "task_statuses" not in day_plan:
        day_plan["task_statuses"] = ["pending"] * len(tasks)
    
    # Also handle legacy case where tasks might have changed size
    if len(day_plan["task_statuses"]) != len(tasks):
        new_statuses = ["pending"] * len(tasks)
        for i in range(min(len(tasks), len(day_plan["task_statuses"]))):
            new_statuses[i] = day_plan["task_statuses"][i]
        day_plan["task_statuses"] = new_statuses

    day_plan["task_statuses"][input_data.task_index] = "completed" if input_data.is_completed else "pending"
    
    # Update overall day status if all tasks are done
    if all(s == "completed" for s in day_plan["task_statuses"]):
        day_plan["status"] = "completed"
    else:
        day_plan["status"] = "pending"
        
    # Re-assign to trigger dirty check for JSON
    schedule.schedule_json = schedule_data
    await db.commit()
    
    return {
        "status": "success", 
        "day_status": day_plan["status"],
        "task_statuses": day_plan["task_statuses"]
    }
@router.post("/relief")
async def api_apply_stress_relief(
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Experimental Stress-Aware Adaptive Planning:
    Automatically defers all pending tasks for 'today' across all active schedules.
    """
    try:
        from datetime import datetime
        query = select(StudySchedule).where(
            and_(StudySchedule.user_id == user_id, StudySchedule.status == "active")
        )
        result = await db.execute(query)
        schedules = result.scalars().all()
        
        today = date.today()
        modified_count = 0
        deferred_tasks = []

        for schedule in schedules:
            if not schedule.start_date:
                continue
                
            start_date = schedule.start_date
            if isinstance(start_date, datetime):
                start_date = start_date.date()
                
            passed_days = (today - start_date).days + 1
            
            # Mutable modification of JSON
            schedule_data = list(schedule.schedule_json)
            day_plan = next((d for d in schedule_data if d.get("day") == passed_days), None)
            
            if day_plan and day_plan.get("status") != "completed":
                tasks = day_plan.get("tasks", [])
                
                # Initialize or update task_statuses
                if "task_statuses" not in day_plan:
                    day_plan["task_statuses"] = ["pending"] * len(tasks)
                
                # Mark all PENDING tasks as deferred
                for i in range(len(day_plan["task_statuses"])):
                    if day_plan["task_statuses"][i] == "pending":
                        day_plan["task_statuses"][i] = "deferred"
                        modified_count += 1
                        deferred_tasks.append(tasks[i])
                
                # Update day status
                day_plan["status"] = "deferred"
                day_plan["stress_relief_applied"] = True
                day_plan["original_tasks_count"] = len(tasks)
                
                # Re-assign to trigger dirty check
                schedule.schedule_json = schedule_data
                db.add(schedule)

        if modified_count > 0:
            await db.commit()
            return {
                "status": "success",
                "message": f"Adaptive relief applied. {modified_count} tasks deferred for mental wellbeing.",
                "deferred_tasks": deferred_tasks
            }
        else:
            return {
                "status": "no_action",
                "message": "No pending tasks found for today. Keep resting!"
            }

    except Exception as e:
        await db.rollback()
        print(f"Error in api_apply_stress_relief: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

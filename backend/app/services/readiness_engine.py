"""
Readiness Engine — Computes composite readiness score from multiple signals.

This is the core of Contrast Requirement #1: Stress/Readiness Assessment.
It combines self-rated wellness, quiz performance, schedule adherence,
and deadline pressure into a single actionable readiness score.
"""
import os
from datetime import date, timedelta
from typing import Optional, List, Dict, Any
import json
from sqlalchemy import select, and_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schedule import (
    WellnessCheckin, ReadinessSnapshot, StudySchedule, DailyCheckin, QuizAttempt
)
from app.models.interview import MockInterview

def safe_json_parse(data: Any) -> Any:
    """Helper to safely handle JSON strings or objects."""
    if data is None: return None
    if isinstance(data, str):
        try:
            return json.loads(data)
        except:
            return None
    return data

async def get_recent_quiz_scores(db: AsyncSession, user_id: str, days: int = 7) -> dict:
    """Get average quiz score from the last N days from all QuizAttempt records."""
    cutoff = date.today() - timedelta(days=days)
    query = select(QuizAttempt).where(
        and_(
            QuizAttempt.user_id == user_id,
            QuizAttempt.date >= cutoff
        )
    )
    result = await db.execute(query)
    attempts = result.scalars().all()

    if not attempts:
        return {"avg_score": 0.0, "total_quizzes": 0, "scores": []}

    scores = []
    for a in attempts:
        pct = (a.score / a.total) * 100 if a.total > 0 else 0
        scores.append(pct)

    avg = sum(scores) / len(scores) if scores else 0.0
    return {"avg_score": round(avg, 1), "total_quizzes": len(scores), "scores": scores}


async def get_recent_mock_scores(db: AsyncSession, user_id: str, days: int = 14) -> dict:
    """Get average mock interview score (0-10) from the last N days."""
    cutoff = date.today() - timedelta(days=days)
    query = select(MockInterview).where(
        and_(
            MockInterview.user_id == user_id,
            MockInterview.created_at >= cutoff,
            MockInterview.status == "completed"
        )
    )
    result = await db.execute(query)
    sessions = result.scalars().all()

    if not sessions:
        return {"avg_score": 0.0, "total_sessions": 0, "scores": []}

    scores = [float(s.final_score or 0.0) for s in sessions if s.final_score is not None]
    avg = sum(scores) / len(scores) if scores else 0.0
    return {"avg_score": round(avg, 1), "total_sessions": len(scores), "scores": scores}


async def get_schedule_adherence(db: AsyncSession, user_id: str) -> dict:
    """Calculate task completion rate across active schedules using granular task data."""
    query = select(StudySchedule).where(
        and_(StudySchedule.user_id == user_id, StudySchedule.status == "active")
    )
    result = await db.execute(query)
    schedules = result.scalars().all()

    if not schedules:
        return {"adherence_rate": 0.0, "completed": 0, "total": 0, "active_schedules": 0}

    total_tasks = 0
    completed_tasks = 0

    for schedule in schedules:
        s_json = schedule.schedule_json
        if not s_json:
            continue
            
        if isinstance(s_json, str):
            import json
            try:
                s_json = json.loads(s_json)
            except:
                continue
                
        today_day = (date.today() - schedule.start_date).days + 1
        for day_plan in s_json:
            day_num = day_plan.get("day", 0)
            if day_num <= today_day:
                    tasks = day_plan.get("tasks", [])
                    num_tasks = len(tasks) if isinstance(tasks, list) else 1
                    
                    # New granular check using task_statuses
                    task_statuses = day_plan.get("task_statuses", [])
                    if task_statuses:
                        completed_in_day = task_statuses.count("completed")
                        completed_tasks += completed_in_day
                    elif day_plan.get("status") == "completed":
                        # Fallback for old schedules with only binary status
                        completed_tasks += num_tasks
                        
                    total_tasks += num_tasks

    rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0.0
    return {
        "adherence_rate": round(rate, 1),
        "completed": completed_tasks,
        "total": total_tasks,
        "active_schedules": len(schedules)
    }


async def get_deadline_pressure(db: AsyncSession, user_id: str) -> dict:
    """Calculate deadline pressure based on nearest active schedule end dates."""
    query = select(StudySchedule).where(
        and_(
            StudySchedule.user_id == user_id,
            StudySchedule.status == "active",
            StudySchedule.event_date >= date.today()
        )
    ).order_by(StudySchedule.event_date)
    result = await db.execute(query)
    schedules = result.scalars().all()

    if not schedules:
        return {"pressure": "none", "nearest_days": None, "nearest_event": None}

    # Filter out schedules with null event_date just in case
    valid_schedules = [s for s in schedules if s.event_date is not None]
    if not valid_schedules:
        return {"pressure": "none", "nearest_days": None, "nearest_event": None}

    nearest = valid_schedules[0]
    days_until = (nearest.event_date - date.today()).days

    if days_until <= 3:
        pressure = "critical"
    elif days_until <= 7:
        pressure = "high"
    elif days_until <= 14:
        pressure = "moderate"
    else:
        pressure = "low"

    return {
        "pressure": pressure,
        "nearest_days": max(0, days_until),
        "nearest_event": getattr(nearest, 'event_name', 'Upcoming Event'),
        "upcoming": [
            {"event": getattr(s, 'event_name', 'Event'), "days": max(0, (s.event_date - date.today()).days)}
            for s in valid_schedules[:5]
        ]
    }


async def get_streak(db: AsyncSession, user_id: str) -> dict:
    """Calculate current and best streak of consecutive daily check-ins."""
    query = select(WellnessCheckin.date).where(
        WellnessCheckin.user_id == user_id
    ).order_by(desc(WellnessCheckin.date))
    result = await db.execute(query)
    dates = [row[0] for row in result.all()]

    if not dates:
        return {"current_streak": 0, "best_streak": 0}

    current_streak = 0
    check_date = date.today()
    for d in dates:
        if d == check_date:
            current_streak += 1
            check_date -= timedelta(days=1)
        elif d == check_date - timedelta(days=1):
            # Allow checking in yesterday if today hasn't been done yet
            current_streak += 1
            check_date = d - timedelta(days=1)
        else:
            break

    # Best streak (simple calculation)
    best_streak = current_streak
    if len(dates) > 1:
        streak = 1
        sorted_dates = sorted(set(dates), reverse=True)
        for i in range(1, len(sorted_dates)):
            if (sorted_dates[i - 1] - sorted_dates[i]).days == 1:
                streak += 1
                best_streak = max(best_streak, streak)
            else:
                streak = 1

    return {"current_streak": current_streak, "best_streak": best_streak}


def classify_stress_level(stress_rating: int) -> str:
    """Convert 1-5 stress rating to a label."""
    if stress_rating <= 1:
        return "low"
    elif stress_rating <= 2:
        return "moderate"
    elif stress_rating <= 3:
        return "moderate"
    elif stress_rating <= 4:
        return "high"
    else:
        return "critical"


def compute_gap_label(perceived: float, predicted: float) -> str:
    """Determine if student is overconfident, underconfident, or accurate."""
    gap = perceived - predicted
    if abs(gap) <= 0.5:
        return "accurate"
    elif gap > 0.5:
        return "overconfident"
    else:
        return "underconfident"


def generate_stress_recommendations(
    stress_level: str,
    gap_label: str,
    adherence_rate: float,
    quiz_avg: float,
    deadline_pressure: str,
    streak: int
) -> list:
    """Generate personalized recommendations based on all signals."""
    recs = []

    # Stress-based recommendations
    if stress_level in ("high", "critical"):
        recs.append({
            "type": "stress_management",
            "message": "Your stress levels are elevated. Consider a 15-minute break or breathing exercise before studying.",
            "priority": "high",
            "action": "take_break"
        })
        recs.append({
            "type": "schedule_adjustment",
            "message": "We recommend reducing today's study load by 20% to avoid burnout.",
            "priority": "high",
            "action": "reduce_load"
        })

    if stress_level == "critical":
        recs.append({
            "type": "intervention",
            "message": "Your stress is critically high. Please consider talking to a counselor or taking the day off.",
            "priority": "critical",
            "action": "seek_support"
        })

    # Gap-based recommendations
    if gap_label == "overconfident":
        recs.append({
            "type": "study_focus",
            "message": "Your quiz scores suggest some topics need more attention than you might think. Focus on weak areas today.",
            "priority": "medium",
            "action": "review_weak_topics"
        })
    elif gap_label == "underconfident":
        recs.append({
            "type": "encouragement",
            "message": "You're doing better than you think! Your quiz scores are strong. Trust your preparation.",
            "priority": "low",
            "action": "none"
        })

    # Adherence-based
    if adherence_rate < 50:
        recs.append({
            "type": "schedule_adjustment",
            "message": "Your task completion rate is low. Try breaking tasks into smaller chunks or adjusting your schedule.",
            "priority": "medium",
            "action": "adjust_schedule"
        })
    elif adherence_rate >= 80:
        recs.append({
            "type": "encouragement",
            "message": f"Great consistency! You've completed {adherence_rate:.0f}% of planned tasks. Keep it up!",
            "priority": "low",
            "action": "none"
        })

    # Quiz performance
    if quiz_avg < 40:
        recs.append({
            "type": "resource_suggestion",
            "message": "Your recent quiz scores are below target. Review uploaded notes or request an AI lesson on weak topics.",
            "priority": "high",
            "action": "ai_teaching"
        })

    # Deadline pressure
    if deadline_pressure in ("critical", "high"):
        recs.append({
            "type": "deadline_alert",
            "message": "An important deadline is approaching soon. Prioritize high-weight topics today.",
            "priority": "high",
            "action": "prioritize_tasks"
        })

    # Streak
    if streak == 0:
        recs.append({
            "type": "motivation",
            "message": "Start a new streak today! Consistency is key to exam success.",
            "priority": "medium",
            "action": "start_checkin"
        })
    elif streak >= 7:
        recs.append({
            "type": "encouragement",
            "message": f"Amazing {streak}-day streak! Your consistency is building real momentum.",
            "priority": "low",
            "action": "none"
        })

    # Sort by priority
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    recs.sort(key=lambda r: priority_order.get(r["priority"], 99))

    return recs


async def compute_composite_readiness(
    db: AsyncSession,
    user_id: str,
    wellness: Optional[WellnessCheckin] = None
) -> dict:
    """
    Compute the full readiness snapshot from all available signals.
    This is the heart of the stress-aware academic planning system.
    """
    # 1. Get today's wellness (or use provided)
    if not wellness:
        query = select(WellnessCheckin).where(
            and_(
                WellnessCheckin.user_id == user_id,
                WellnessCheckin.date == date.today()
            )
        ).order_by(desc(WellnessCheckin.created_at))
        result = await db.execute(query)
        wellness = result.scalar_one_or_none()

    # 2. Gather all signals
    quiz_data = await get_recent_quiz_scores(db, user_id)
    mock_data = await get_recent_mock_scores(db, user_id)
    adherence_data = await get_schedule_adherence(db, user_id)
    deadline_data = await get_deadline_pressure(db, user_id)
    streak_data = await get_streak(db, user_id)

    # 3. Calculate perceived readiness (from self-rating)
    perceived = 3.0
    if wellness:
        val = getattr(wellness, 'readiness', 3.0)
        perceived = float(val) if val is not None else 3.0

    # 4. Calculate predicted readiness (from objective data)
    q_avg = quiz_data.get("avg_score", 0.0)
    quiz_factor = (float(q_avg) / 100 * 5) if q_avg else 0.0
    
    adh_rate = adherence_data.get("adherence_rate", 0.0)
    adherence_factor = (float(adh_rate) / 100 * 5) if adh_rate else 0.0
    
    streak_val = streak_data.get("current_streak", 0)
    streak_factor = min(float(streak_val) / 7, 1.0) * 5 if streak_val else 0.0

    m_avg = mock_data.get("avg_score", 0.0)
    mock_factor = (float(m_avg) / 10 * 5) if m_avg else 0.0

    # Weighted average for predicted readiness
    predicted = (
        quiz_factor * 0.35 +
        mock_factor * 0.25 +
        adherence_factor * 0.25 +
        streak_factor * 0.10 +
        (3.0 * 0.05)  # baseline
    )
    predicted = round(min(max(predicted, 1.0), 5.0), 2)

    # 5. Gap analysis
    gap_score = round(perceived - predicted, 2)
    gap_label = compute_gap_label(perceived, predicted)

    # 6. Stress level
    stress_rating = wellness.stress if wellness else 3
    stress_level = classify_stress_level(stress_rating)

    # 7. Composite score (0-100)
    wellness_score = 0
    if wellness:
        # Average of confidence, inverse-stress, readiness, energy
        inverse_stress = 6 - wellness.stress  # flip so 5=calm, 1=stressed
        wellness_score = (wellness.confidence + inverse_stress + wellness.readiness + wellness.energy) / 4

    composite = (
        quiz_data["avg_score"] * 0.25 +       # 25% quiz performance
        (mock_data["avg_score"] * 10) * 0.15 + # 15% mock interview (scaled to 100)
        adherence_data["adherence_rate"] * 0.25 +  # 25% task completion
        (wellness_score / 5 * 100) * 0.20 +   # 20% wellness
        (streak_data["current_streak"] / 14 * 100) * 0.05 +  # 5% streak (capped at 14 days)
        (max(0, 100 - (0 if deadline_data["nearest_days"] is None else max(0, 30 - deadline_data["nearest_days"]) * 3.3))) * 0.10  # 10% deadline awareness
    )
    composite = round(min(max(composite, 0), 100), 1)

    # 8. Build factors breakdown early to pass to recommendations
    factors = {
        "quiz_avg": quiz_data["avg_score"],
        "quiz_count": quiz_data["total_quizzes"],
        "mock_avg": mock_data["avg_score"],
        "mock_count": mock_data["total_sessions"],
        "adherence_rate": adherence_data["adherence_rate"],
        "tasks_completed": adherence_data["completed"],
        "tasks_total": adherence_data["total"],
        "active_schedules": adherence_data["active_schedules"],
        "current_streak": streak_data["current_streak"],
        "best_streak": streak_data["best_streak"],
        "deadline_pressure": deadline_data["pressure"],
        "nearest_deadline_days": deadline_data["nearest_days"],
        "nearest_event": deadline_data.get("nearest_event"),
        "wellness_confidence": wellness.confidence if wellness else None,
        "wellness_stress": wellness.stress if wellness else None,
        "wellness_energy": wellness.energy if wellness else None,
    }

    # Prepare data for LLM recommendation engine
    readiness_data = {
        "composite_score": composite,
        "perceived_readiness": float(perceived),
        "predicted_readiness": predicted,
        "gap_score": gap_score,
        "gap_label": gap_label,
        "stress_level": stress_level,
        "factors": factors
    }

    # Fetch user profile data if necessary (For now we will pass a placeholder, since Firestore is decoupled)
    # The actual implementation could fetch this from Firestore, but this suffices for the engine.
    user_data = {"major": "Computer Science", "targetRoles": ["Software Engineer"]}
    
    from app.services.recommendation_engine import generate_recommendations
    
    # 9. Generate recommendations via Groq
    recommendations = await generate_recommendations(user_data, readiness_data)

    return {
        "composite_score": composite,
        "perceived_readiness": float(perceived),
        "predicted_readiness": predicted,
        "gap_score": gap_score,
        "gap_label": gap_label,
        "stress_level": stress_level,
        "factors": factors,
        "recommendations": recommendations,
    }

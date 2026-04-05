"""
interviews.py — API routes for mock interview sessions.
Wraps interview_service.py with Firebase auth + Postgres persistence.
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.utils.auth import verify_firebase_token
from app.models.interview import MockInterview
from app.services.interview_service import (
    parse_resume_bytes,
    extract_candidate_name,
    agent_profile_summary,
    agent_generate_question,
    agent_evaluate_answer,
    agent_final_report,
    determine_initial_difficulty,
    adjust_difficulty,
    is_strike_answer,
    MAX_QUESTIONS,
    MAX_STRIKES,
    PLAGIARISM_PENALTY,
)

router = APIRouter(prefix="/api/interviews", tags=["interviews"])


class AnswerRequest(BaseModel):
    answer: str


# ── START INTERVIEW ─────────────────────────────────────────────────────────

@router.post("/start")
async def start_interview(
    resume_file: UploadFile = File(...),
    skill_file: Optional[UploadFile] = File(None),
    interview_type: str = Form("technical"),
    pasted_questions: Optional[str] = Form(None),
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    """Create a new interview session — parse resume, generate first question."""
    resume_content = await resume_file.read()
    resume_text = parse_resume_bytes(resume_content, resume_file.filename or "resume.txt")
    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Resume file is empty or could not be parsed.")

    skill_text = ""
    if skill_file:
        skill_content = await skill_file.read()
        skill_text = skill_content.decode("utf-8", errors="replace")

    # If no skill file, extract skills from resume
    if not skill_text.strip():
        skill_text = "Skills extracted from resume context."

    # Parse pasted questions
    predefined = []
    if pasted_questions and pasted_questions.strip():
        # Split by newline and clean
        predefined = [q.strip() for q in pasted_questions.split('\n') if q.strip()]
        # Remove common delimiters like "1. ", "- ", etc.
        predefined = [re.sub(r'^(\d+[\.\)]\s*|[-\*\+]\s*)', '', q) for q in predefined]

    # Profile analysis via Groq
    profile = agent_profile_summary(resume_text, skill_text)
    candidate_name = profile.get("name") or extract_candidate_name(resume_text)
    initial_difficulty = determine_initial_difficulty(profile)
    profile_summary = profile.get("summary", "")

    # Generate or pick first question
    question_text = ""
    topic = "Custom"
    
    if predefined:
        question_text = predefined.pop(0)
    else:
        q_data = agent_generate_question(
            profile_summary=str(profile),
            difficulty=initial_difficulty,
            asked_topics=[]
        )
        question_text = q_data.get("question", "Tell me about yourself and your technical background.")
        topic = q_data.get("topic", "General")

    session_id = str(uuid.uuid4())

    interview = MockInterview(
        id=str(uuid.uuid4()),
        user_id=user_id,
        session_id=session_id,
        status="active",
        candidate_name=candidate_name,
        interview_type=interview_type,
        current_difficulty=initial_difficulty,
        strikes=0,
        question_count=1,
        total_raw_score=0.0,
        resume_text=resume_text[:8000],
        skill_text=skill_text[:4000],
        profile_summary=str(profile),
        current_question=question_text,
        current_topic=topic,
        asked_questions=[question_text],
        asked_topics=[topic],
        predefined_questions=predefined,
        transcript_json=[],
    )

    db.add(interview)
    await db.commit()

    return {
        "session_id": session_id,
        "candidate_name": candidate_name,
        "initial_difficulty": initial_difficulty,
        "strikes": 0,
        "question_count": 1,
        "question": question_text,
        "topic": topic,
        "status": "active",
        "interview_type": interview_type,
    }


# ── SUBMIT ANSWER ───────────────────────────────────────────────────────────

@router.post("/{session_id}/answer")
async def submit_answer(
    session_id: str,
    payload: AnswerRequest,
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    """Submit an answer, evaluate it, adjust difficulty, return next question or final report."""
    result = await db.execute(
        select(MockInterview).where(
            MockInterview.session_id == session_id,
            MockInterview.user_id == user_id,
        )
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview session not found.")
    if interview.status == "completed":
        raise HTTPException(status_code=400, detail="Interview already completed.")

    answer = payload.answer
    question = interview.current_question
    topic = interview.current_topic
    difficulty_before = interview.current_difficulty
    transcript = list(interview.transcript_json or [])

    # Strike check
    strike = is_strike_answer(answer)

    if strike:
        interview.strikes += 1
        entry = {
            "question_number": interview.question_count,
            "question": question,
            "topic": topic,
            "difficulty": difficulty_before,
            "answer": answer if answer.strip() else "(no answer)",
            "is_strike": True,
            "score": 0,
            "feedback": "Answer counted as a strike.",
        }
        transcript.append(entry)
        interview.transcript_json = transcript

        if interview.strikes >= MAX_STRIKES:
            return await _finalize(interview, "max_strikes_reached", db)

        # Next question - also DOWNSCALE DIFFICULTY on strike
        interview.question_count += 1
        interview.current_difficulty = adjust_difficulty(interview.current_difficulty, "DOWN")
        
        predefined = list(interview.predefined_questions or [])
        if predefined:
            next_q = predefined.pop(0)
            next_t = "Custom"
            interview.predefined_questions = predefined
        else:
            q_data = agent_generate_question(
                profile_summary=interview.profile_summary,
                difficulty=interview.current_difficulty,
                asked_topics=list(interview.asked_topics or []),
            )
            next_q = q_data.get("question", "Could you elaborate on another area?")
            next_t = q_data.get("topic", "General")
            
        interview.current_question = next_q
        interview.current_topic = next_t
        asked_q = list(interview.asked_questions or [])
        asked_q.append(next_q)
        interview.asked_questions = asked_q
        asked_t = list(interview.asked_topics or [])
        asked_t.append(next_t)
        interview.asked_topics = asked_t

        await db.commit()

        return {
            "session_id": session_id,
            "status": "active",
            "strikes": interview.strikes,
            "question_score": 0,
            "feedback": "Answer counted as a strike.",
            "difficulty_before": difficulty_before,
            "difficulty_after": interview.current_difficulty,
            "next_question": next_q,
            "next_topic": next_t,
            "question_count": interview.question_count,
        }

    # Evaluate with Groq
    eval_result = agent_evaluate_answer(
        question=question,
        answer=answer,
        difficulty=difficulty_before,
        profile_summary=interview.profile_summary,
    )

    raw_score = eval_result["score"]
    plagiarism_flag = bool(eval_result.get("plagiarism_flag", False))
    plagiarism_reason = eval_result.get("plagiarism_reason", "")

    effective_score = raw_score
    if plagiarism_flag:
        effective_score = max(0, int(raw_score * (1 - PLAGIARISM_PENALTY)))

    interview.total_raw_score = (interview.total_raw_score or 0) + effective_score

    # Adjust difficulty
    new_difficulty = adjust_difficulty(
        interview.current_difficulty,
        eval_result.get("adjust_difficulty", "SAME"),
    )
    interview.current_difficulty = new_difficulty

    entry = {
        "question_number": interview.question_count,
        "question": question,
        "topic": topic,
        "difficulty": difficulty_before,
        "answer": answer,
        "score": effective_score,
        "feedback": eval_result.get("feedback", ""),
        "plagiarism_flag": plagiarism_flag,
        "plagiarism_reason": plagiarism_reason,
        "is_sus": eval_result.get("is_sus", False),
        "sus_reason": eval_result.get("sus_reason", ""),
        "is_strike": False,
    }
    transcript.append(entry)
    interview.transcript_json = transcript

    # Max questions reached
    if interview.question_count >= MAX_QUESTIONS:
        return await _finalize(interview, "max_questions_reached", db)

    # Next question
    interview.question_count += 1
    
    predefined = list(interview.predefined_questions or [])
    if predefined:
        next_q = predefined.pop(0)
        next_t = "Custom"
        interview.predefined_questions = predefined
    else:
        q_data = agent_generate_question(
            profile_summary=interview.profile_summary,
            difficulty=interview.current_difficulty,
            asked_topics=list(interview.asked_topics or []),
        )
        next_q = q_data.get("question", "Tell me more about your technical experience.")
        next_t = q_data.get("topic", "General")
        
    interview.current_question = next_q
    interview.current_topic = next_t
    asked_q = list(interview.asked_questions or [])
    asked_q.append(next_q)
    interview.asked_questions = asked_q
    asked_t = list(interview.asked_topics or [])
    asked_t.append(next_t)
    interview.asked_topics = asked_t

    await db.commit()

    return {
        "session_id": session_id,
        "status": "active",
        "strikes": interview.strikes,
        "question_score": effective_score,
        "feedback": eval_result.get("feedback", ""),
        "plagiarism_flag": plagiarism_flag,
        "plagiarism_reason": plagiarism_reason,
        "is_sus": eval_result.get("is_sus", False),
        "sus_reason": eval_result.get("sus_reason", ""),
        "difficulty_before": difficulty_before,
        "difficulty_after": new_difficulty,
        "next_question": next_q,
        "next_topic": next_t,
        "question_count": interview.question_count,
    }


# ── END INTERVIEW (USER TRIGGERED) ─────────────────────────────────────────

@router.post("/{session_id}/end")
async def end_interview(
    session_id: str,
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    """User manually ends the interview early."""
    result = await db.execute(
        select(MockInterview).where(
            MockInterview.session_id == session_id,
            MockInterview.user_id == user_id,
        )
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Session not found.")
    if interview.status == "completed":
        raise HTTPException(status_code=400, detail="Already completed.")

    return await _finalize(interview, "user_ended", db)


# ── GET SESSION ─────────────────────────────────────────────────────────────

@router.get("/{session_id}")
async def get_session(
    session_id: str,
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MockInterview).where(
            MockInterview.session_id == session_id,
            MockInterview.user_id == user_id,
        )
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Session not found.")

    return {
        "session_id": interview.session_id,
        "candidate_name": interview.candidate_name,
        "status": interview.status,
        "current_difficulty": interview.current_difficulty,
        "strikes": interview.strikes,
        "question_count": interview.question_count,
        "current_question": interview.current_question if interview.status == "active" else None,
        "current_topic": interview.current_topic if interview.status == "active" else None,
        "interview_type": interview.interview_type,
        "transcript": interview.transcript_json,
        "created_at": str(interview.created_at),
    }


# ── GET REPORT ──────────────────────────────────────────────────────────────

@router.get("/{session_id}/report")
async def get_report(
    session_id: str,
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MockInterview).where(
            MockInterview.session_id == session_id,
            MockInterview.user_id == user_id,
        )
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Session not found.")
    if interview.status != "completed":
        raise HTTPException(status_code=400, detail="Interview still in progress.")

    return {
        "session_id": interview.session_id,
        "candidate_name": interview.candidate_name,
        "final_score": interview.final_score,
        "summary": interview.summary,
        "strengths": interview.strengths_json,
        "improvements": interview.weaknesses_json,
        "topic_breakdown": interview.topic_breakdown_json,
        "strikes": interview.strikes,
        "questions_asked": interview.question_count,
        "completion_reason": interview.completion_reason,
        "transcript": interview.transcript_json,
    }


# ── INTERVIEW HISTORY ───────────────────────────────────────────────────────

@router.get("")
async def list_interviews(
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    """List all interviews for the current user, newest first."""
    result = await db.execute(
        select(MockInterview)
        .where(MockInterview.user_id == user_id)
        .order_by(MockInterview.created_at.desc())
        .limit(20)
    )
    interviews = result.scalars().all()

    return [
        {
            "session_id": i.session_id,
            "candidate_name": i.candidate_name,
            "status": i.status,
            "interview_type": i.interview_type,
            "final_score": i.final_score,
            "question_count": i.question_count,
            "strikes": i.strikes,
            "completion_reason": i.completion_reason,
            "created_at": str(i.created_at),
        }
        for i in interviews
    ]


# ── INTERNAL HELPERS ────────────────────────────────────────────────────────

async def _finalize(interview: MockInterview, reason: str, db: AsyncSession):
    """Generate final report, update interview record, commit."""
    interview.status = "completed"
    interview.completion_reason = reason
    interview.completed_at = datetime.utcnow()

    transcript = list(interview.transcript_json or [])

    # Generate report via Groq
    report = agent_final_report(
        candidate_name=interview.candidate_name,
        question_count=interview.question_count,
        strikes=interview.strikes,
        transcript=transcript,
    )

    # Cross-check raw score
    if interview.question_count > 0:
        raw_pct = ((interview.total_raw_score or 0) / (interview.question_count * 10)) * 100
    else:
        raw_pct = 0.0

    llm_score = report.get("final_score", 0)
    final_score = llm_score if llm_score > 0 else int(round(raw_pct))
    final_score = max(0, min(100, final_score))

    interview.final_score = final_score
    interview.summary = report.get("summary", "")
    interview.strengths_json = report.get("strengths", [])
    interview.weaknesses_json = report.get("improvements", [])
    interview.topic_breakdown_json = report.get("topic_breakdown", [])

    await db.commit()

    return {
        "session_id": interview.session_id,
        "status": "completed",
        "strikes": interview.strikes,
        "question_count": interview.question_count,
        "reason": reason,
        "final_score": final_score,
        "summary": interview.summary,
        "strengths": interview.strengths_json,
        "improvements": interview.weaknesses_json,
        "topic_breakdown": interview.topic_breakdown_json,
    }

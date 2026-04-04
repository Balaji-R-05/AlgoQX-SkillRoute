from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict
from app.services.quiz_agent import generate_quiz, evaluate_quiz
from app.utils.auth import verify_firebase_token
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.schedule import QuizAttempt

router = APIRouter(
    prefix="/api/quiz",
    tags=["Quiz"]
)


class QuizGenerateRequest(BaseModel):
    skills: List[str]


class QuizEvaluateRequest(BaseModel):
    questions: List[dict]
    answers: Dict[str, str]


@router.post("/generate")
async def generate_skill_quiz(
    request: QuizGenerateRequest,
    user_id: str = Depends(verify_firebase_token)
):
    try:
        if not request.skills or len(request.skills) == 0:
            raise HTTPException(status_code=400, detail="At least one skill is required")

        result = await generate_quiz(request.skills)
        return {
            "status": "success",
            "quiz": result
        }
    except Exception as e:
        print(f"Error generating quiz: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evaluate")
async def evaluate_skill_quiz(
    request: QuizEvaluateRequest,
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await evaluate_quiz(request.questions, request.answers)
        
        # Save to QuizAttempt for analytics
        score = result.get("score", 0)
        total = result.get("total", 0)
        topics = ",".join(list(set([q.get("topic", "general") for q in request.questions])))

        attempt = QuizAttempt(
            user_id=user_id,
            quiz_type="skill_assessment",
            score=score,
            total=total,
            topics=topics
        )
        db.add(attempt)
        await db.commit()

        return {
            "status": "success",
            "evaluation": result
        }
    except Exception as e:
        print(f"Error evaluating quiz: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mastery")
async def api_get_topic_mastery(
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    try:
        query = select(QuizAttempt).where(QuizAttempt.user_id == user_id)
        result = await db.execute(query)
        attempts = result.scalars().all()
        
        mastery = {}
        for a in attempts:
            if a.topics:
                # Handle both comma-separated and potentially JSON
                topics_list = a.topics.replace("[", "").replace("]", "").replace("\"", "").split(",")
                for t in topics_list:
                    topic_name = t.strip()
                    if not topic_name: continue
                    if topic_name not in mastery:
                        mastery[topic_name] = {"correct": 0, "total": 0}
                    mastery[topic_name]["correct"] += a.score
                    mastery[topic_name]["total"] += a.total
                    
        summary = []
        for t, data in mastery.items():
            if data["total"] > 0:
                summary.append({
                    "topic": t,
                    "mastery": round((data["correct"] / data["total"]) * 100, 1),
                    "attempts": data["total"]
                })
        
        return sorted(summary, key=lambda x: x["mastery"], reverse=True)
    except Exception as e:
        print(f"Error computing mastery: {e}")
        raise HTTPException(status_code=500, detail=str(e))

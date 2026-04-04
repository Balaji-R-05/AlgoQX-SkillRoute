"""
teaching.py — API routes for the AI Teaching Assistant.
Allows students to learn from their uploaded resources via RAG + TTS.
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.utils.auth import verify_firebase_token
from app.models.resource import StudyResource as Resource
from app.services.teaching_service import (
    load_document,
    generate_lesson,
    answer_doubt,
    synthesize_audio,
    cleanup_audio,
    AUDIO_DIR,
)
from app.services.s3_service import s3_service

router = APIRouter(prefix="/api/teaching", tags=["teaching"])


class LoadRequest(BaseModel):
    resource_id: str


class LessonRequest(BaseModel):
    resource_id: str
    topic: str


class DoubtRequest(BaseModel):
    resource_id: str
    question: str


# ── LOAD RESOURCE FOR TEACHING ──────────────────────────────────────────────

@router.post("/load")
async def load_resource_for_teaching(
    payload: LoadRequest,
    user_id: str = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    """Load a resource from S3 and prepare it for teaching."""
    result = await db.execute(
        select(Resource).where(Resource.id == payload.resource_id)
    )
    resource = result.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")

    # For now, use the resource's content_text if available,
    # otherwise use title + description as context
    text = ""
    if hasattr(resource, "content_text") and resource.content_text:
        text = resource.content_text
    else:
        # Build context from available resource metadata
        parts = []
        if resource.title:
            parts.append(f"Title: {resource.title}")
        if hasattr(resource, "description") and resource.description:
            parts.append(f"Description: {resource.description}")
        if hasattr(resource, "tags") and resource.tags:
            parts.append(f"Topics: {', '.join(resource.tags) if isinstance(resource.tags, list) else resource.tags}")
        text = "\n".join(parts) if parts else "No content available for this resource."

    source_name = resource.title or "Uploaded Resource"
    result = load_document(user_id, payload.resource_id, text, source_name)
    return result


# ── TEACH LESSON ────────────────────────────────────────────────────────────

@router.post("/lesson")
async def teach_lesson(
    payload: LessonRequest,
    user_id: str = Depends(verify_firebase_token),
):
    """Generate an AI lesson on a topic from the loaded resource."""
    lesson_result = generate_lesson(user_id, payload.resource_id, payload.topic)
    if not lesson_result.get("success"):
        raise HTTPException(status_code=400, detail=lesson_result.get("error", "Failed to generate lesson."))

    # Generate audio
    audio_filename = await synthesize_audio(lesson_result.get("lesson", ""))

    return {
        "success": True,
        "topic": payload.topic,
        "lesson": lesson_result.get("lesson", ""),
        "audio_file": audio_filename,
    }


# ── ASK DOUBT ───────────────────────────────────────────────────────────────

@router.post("/doubt")
async def ask_doubt(
    payload: DoubtRequest,
    user_id: str = Depends(verify_firebase_token),
):
    """Ask a doubt about the current lesson."""
    result = answer_doubt(user_id, payload.resource_id, payload.question)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to answer doubt."))

    audio_filename = await synthesize_audio(result.get("answer", ""))

    return {
        "success": True,
        "question": payload.question,
        "answer": result.get("answer", ""),
        "audio_file": audio_filename,
    }


class GeneralDoubtRequest(BaseModel):
    question: str

@router.post("/general")
async def ask_general(
    payload: GeneralDoubtRequest,
    user_id: str = Depends(verify_firebase_token),
):
    """Ask a general academic doubt (no resource required)."""
    from app.services.teaching_service import ask_general_doubt
    result = ask_general_doubt(user_id, payload.question)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to answer doubt."))

    audio_filename = await synthesize_audio(result.get("answer", ""))

    return {
        "success": True,
        "question": payload.question,
        "answer": result.get("answer", ""),
        "audio_file": audio_filename,
    }


# ── SERVE AUDIO ─────────────────────────────────────────────────────────────

@router.get("/audio/{filename}")
async def get_audio(filename: str):
    filepath = os.path.join(AUDIO_DIR, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Audio file not found.")
    return FileResponse(filepath, media_type="audio/mpeg")


# ── CLEANUP ─────────────────────────────────────────────────────────────────

@router.post("/cleanup")
async def cleanup(user_id: str = Depends(verify_firebase_token)):
    count = cleanup_audio()
    return {"cleaned": count}

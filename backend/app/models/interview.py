"""
MockInterview model — persists interview sessions to Postgres
instead of in-memory dict from original interview.py
"""
import uuid
from sqlalchemy import Column, String, Integer, Float, Text, JSON, DateTime
from sqlalchemy.sql import func
from app.database import Base


class MockInterview(Base):
    """Persisted mock interview session with full transcript and report."""
    __tablename__ = "mock_interviews"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True, nullable=False)
    session_id = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="active")  # active | completed
    candidate_name = Column(String, default="Candidate")
    interview_type = Column(String, default="technical")  # technical, dsa, aptitude, mixed
    current_difficulty = Column(String, default="MEDIUM")
    strikes = Column(Integer, default=0)
    question_count = Column(Integer, default=0)
    total_raw_score = Column(Float, default=0.0)
    final_score = Column(Integer, default=0)
    resume_text = Column(Text, default="")
    skill_text = Column(Text, default="")
    profile_summary = Column(Text, default="")
    current_question = Column(Text, default="")
    current_topic = Column(String, default="")
    asked_questions = Column(JSON, default=list)
    asked_topics = Column(JSON, default=list)
    transcript_json = Column(JSON, default=list)
    strengths_json = Column(JSON, default=list)
    weaknesses_json = Column(JSON, default=list)
    topic_breakdown_json = Column(JSON, default=list)
    summary = Column(Text, default="")
    completion_reason = Column(String, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

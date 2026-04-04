import uuid
from sqlalchemy import Column, String, Integer, Float, Text, Date, JSON, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base

class StudySchedule(Base):
    __tablename__ = "study_schedules"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True)
    title = Column(String)
    event_name = Column(String)
    event_date = Column(Date)
    syllabus_content = Column(Text)
    start_date = Column(Date)
    end_date = Column(Date)
    daily_hours = Column(Integer)
    schedule_json = Column(JSON) # Array of objects: { day: 1, title: "", tasks: [], status: "pending" }
    status = Column(String, default="active") # active, completed, archived
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class DailyCheckin(Base):
    __tablename__ = "daily_checkins"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    schedule_id = Column(String, ForeignKey("study_schedules.id", ondelete="CASCADE"), index=True)
    user_id = Column(String, index=True)
    date = Column(Date, server_default=func.current_date())
    mcq_json = Column(JSON) # Array of 5 questions: { question: "", options: [], correct_answer: "" }
    results_json = Column(JSON) # User score, answers, explanation
    is_completed = Column(Integer, default=0) # 0=pending, 1=completed
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WellnessCheckin(Base):
    """Daily self-rated wellness check-in for stress-aware planning."""
    __tablename__ = "wellness_checkins"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True, nullable=False)
    date = Column(Date, server_default=func.current_date(), index=True)
    confidence = Column(Integer, nullable=False)   # 1-5 scale
    stress = Column(Integer, nullable=False)        # 1-5 scale (5 = high stress)
    readiness = Column(Integer, nullable=False)     # 1-5 scale (self-perceived)
    energy = Column(Integer, nullable=False)        # 1-5 scale
    notes = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ReadinessSnapshot(Base):
    """Computed readiness snapshot combining self-rating, quiz, schedule, and interview data."""
    __tablename__ = "readiness_snapshots"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True, nullable=False)
    date = Column(Date, server_default=func.current_date(), index=True)
    perceived_readiness = Column(Float)         # from wellness check-in (1-5)
    predicted_readiness = Column(Float)         # computed from quiz + adherence
    gap_score = Column(Float)                   # perceived - predicted
    gap_label = Column(String)                  # "accurate", "overconfident", "underconfident"
    composite_score = Column(Float)             # overall 0-100 readiness
    stress_level = Column(String)               # "low", "moderate", "high", "critical"
    factors_json = Column(JSON)                 # breakdown: { quiz_avg, adherence_rate, streak, deadline_pressure, ... }
    recommendations_json = Column(JSON)         # array of { type, message, priority, action }
    created_at = Column(DateTime(timezone=True), server_default=func.now())


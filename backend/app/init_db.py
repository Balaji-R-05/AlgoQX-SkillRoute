"""
Database initialization script.
Run this to create all tables (including new wellness/readiness tables).

Usage: cd backend && venv/bin/python -m app.init_db
"""
import asyncio
from app.database import engine, Base

# Import ALL models to register them with Base.metadata
from app.models.schedule import StudySchedule, DailyCheckin, WellnessCheckin, ReadinessSnapshot
from app.models.resource import StudyResource, ResourceChunk
from app.models.interview import MockInterview


async def init_db():
    print("🔄 Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ All tables created successfully!")
    print("   Tables: study_schedules, daily_checkins, wellness_checkins, readiness_snapshots, study_resources, resource_chunks, mock_interviews")


if __name__ == "__main__":
    asyncio.run(init_db())

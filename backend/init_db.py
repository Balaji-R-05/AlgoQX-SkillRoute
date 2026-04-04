import asyncio
from app.database import engine, Base
from app.models.resource import StudyResource, ResourceChunk
from app.models.schedule import StudySchedule, DailyCheckin

async def init_db():
    async with engine.begin() as conn:
        # Create all tables (Alembic is better, but this works for development)
        await conn.run_sync(Base.metadata.create_all)
    print("Database initialized successfully!")

if __name__ == "__main__":
    asyncio.run(init_db())

import asyncio
from app.database import AsyncSessionLocal
from app.models.schedule import QuizAttempt
from sqlalchemy import select

async def check_data():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(QuizAttempt))
        attempts = result.scalars().all()
        print(f"Found {len(attempts)} attempts")
        for a in attempts:
            print(f"Attempt {a.id}: score={a.score}, total={a.total}, topics={a.topics}")

if __name__ == "__main__":
    asyncio.run(check_data())

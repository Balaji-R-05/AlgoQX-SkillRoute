import asyncio
import os
from sqlalchemy import text
from app.database import engine

async def fix_database():
    print("Connecting to database to add missing columns...")
    async with engine.begin() as conn:
        try:
            # Add predefined_questions column to mock_interviews
            await conn.execute(text("ALTER TABLE mock_interviews ADD COLUMN IF NOT EXISTS predefined_questions JSONB DEFAULT '[]'::jsonb"))
            print("Successfully added 'predefined_questions' column to 'mock_interviews' table.")
        except Exception as e:
            print(f"Error adding column: {e}")
            # If JSONB fails (standard postgres), try JSON
            try:
                await conn.execute(text("ALTER TABLE mock_interviews ADD COLUMN IF NOT EXISTS predefined_questions JSON DEFAULT '[]'"))
                print("Successfully added 'predefined_questions' column as JSON.")
            except Exception as e2:
                print(f"Retry failed: {e2}")

if __name__ == "__main__":
    asyncio.run(fix_database())

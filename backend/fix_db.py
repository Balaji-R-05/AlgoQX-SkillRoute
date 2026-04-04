import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy.future import select
from sqlalchemy import delete
from app.models.resource import StudyResource, ResourceChunk

async def main():
    async with AsyncSessionLocal() as db:
        # Check resources that have strange user_ids
        stmt = select(StudyResource).where(StudyResource.user_id.like('%.pdf') | StudyResource.user_id.like('%.jpg') | StudyResource.user_id.like('%.png'))
        result = await db.execute(stmt)
        resources = result.scalars().all()
        for r in resources:
            print(f"Deleting bad user_id resource: {r.user_id} - {r.id}")
            # Delete chunks first (though CASCADE should handle it, doing it explicitly or just relying on cascade)
            await db.delete(r)
        
        await db.commit()
        print("Done deleting bad records")

if __name__ == "__main__":
    asyncio.run(main())

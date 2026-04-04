import asyncio
from app.services.s3_service import s3_service
from app.database import AsyncSessionLocal
from sqlalchemy.future import select
from app.models.resource import StudyResource

async def main():
    keys = s3_service.list_all_files("uploads/")
    print(f"Total files under 'uploads/': {len(keys)}")
    for k in keys:
        print(k)

    async with AsyncSessionLocal() as db:
        stmt = select(StudyResource.user_id, StudyResource.id, StudyResource.title)
        result = await db.execute(stmt)
        resources = result.all()
        print("\nResources in DB:")
        for r in resources:
            print(r)

if __name__ == "__main__":
    asyncio.run(main())

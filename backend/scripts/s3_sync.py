import os
import asyncio
import boto3
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

# Standalone script to sync S3 bucket to Postgres database.
# This maps S3 object keys like 'uploads/{user_id}/...' to Resource records.

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.resource import StudyResource
from app.database import DATABASE_URL

load_dotenv()

async def sync_all_users():
    """
    Scans the entire S3 bucket, logs internal keys, and populates the Postgres database.
    """
    print("🚀 Starting S3 to DB Sync...")
    
    bucket_name = os.getenv('AWS_STORAGE_BUCKET_NAME')
    s3_client = boto3.client(
        's3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_S3_REGION_NAME', 'ap-southeast-1')
    )
    
    engine = create_async_engine(DATABASE_URL)
    AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    
    try:
        response = s3_client.list_objects_v2(Bucket=bucket_name)
        if 'Contents' not in response:
            print("⚠️ Bucket is empty or no files found.")
            return

        async with AsyncSessionLocal() as db:
            new_count = 0
            for obj in response['Contents']:
                key = obj['Key']
                print(f"🔍 Analyzing key: {key}")
                
                parts = key.split("/")
                if len(parts) >= 2:
                    # heuristic: prefix like uploads/ or bot_uploads/
                    if parts[0] in ["uploads", "bot_uploads", "documents"]:
                        user_id = parts[1]
                        filename = parts[-1]
                    else:
                        user_id = parts[0]
                        filename = parts[-1]
                else:
                    filename = key
                    user_id = "default-user"

                if filename.endswith("/") or not filename:
                    continue # skip directories
                
                region = os.getenv('AWS_S3_REGION_NAME', 'ap-southeast-1')
                url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{key}"
                
                # Check if exists
                stmt = select(StudyResource).where(StudyResource.url == url)
                res = await db.execute(stmt)
                if not res.scalar_one_or_none():
                    print(f"➕ Found new resource: {filename} (User: {user_id})")
                    new_res = StudyResource(
                        user_id=user_id,
                        title=filename.replace(".pdf", "").replace("_", " ").title(),
                        url=url,
                        resource_type="PDF" if key.lower().endswith(".pdf") else "S3 File",
                        category="Legacy Import"
                    )
                    db.add(new_res)
                    new_count += 1
            
            await db.commit()
            print(f"✅ Sync complete. Added {new_count} new resources.")
            
    except Exception as e:
        print(f"❌ Error during sync: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(sync_all_users())

import os
import uuid
import logging
from app.services.s3_service import s3_service
from app.services.embedding_service import chunk_and_embed
from app.database import AsyncSessionLocal
from app.models.resource import StudyResource

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def handle_incoming_pdf(phone_or_id: str, pdf_bytes: bytes, filename: str) -> str:
    """Handles an incoming PDF: uploads to S3, saves DB record, processes embeddings."""
    
    async with AsyncSessionLocal() as db:
        user_id = phone_or_id
        
        # 1. Upload to S3
        s3_filename = f"uploads/{user_id}/{uuid.uuid4()}/{filename}"
        
        try:
            url = await s3_service.upload_file(pdf_bytes, s3_filename)
        except Exception as e:
            logger.error(f"S3 Upload failed: {e}")
            return "❌ Failed to upload PDF to storage."

        # 2. Save resource record in Postgres
        resource = StudyResource(
            user_id=user_id,
            title=filename.replace(".pdf", "").replace("_", " ").title(),
            url=url, 
            resource_type="PDF",
            category="General",
        )
        db.add(resource)
        await db.commit()
        await db.refresh(resource)

        # 3. Chunk + Embed asynchronously
        try:
            await chunk_and_embed(resource.id, pdf_bytes, db)
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            return "❌ Uploaded file, but failed to process AI embeddings."

    return f"✅ '{filename}' added to your Resource Hub & processed successfully!"

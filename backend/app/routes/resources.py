import os
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, desc
from pydantic import BaseModel
from typing import List, Optional
import boto3

from app.database import get_db
from app.models.resource import StudyResource, ResourceChunk
from app.services.embedding_service import embed_texts
from app.services.s3_service import s3_service

router = APIRouter(prefix="/resources", tags=["resources"])

async def get_current_user_id(x_user_id: str = Header(None)):
    """
    Extracts the user_id from the 'x-user-id' header. 
    In production, this should decode a Firebase JWT token.
    """
    if not x_user_id:
        return "mock-user-123" # Default for testing
    return x_user_id

class ResourceResponse(BaseModel):
    id: str
    title: str
    url: str
    resource_type: str
    category: str

    class Config:
        from_attributes = True

class AddResourceRequest(BaseModel):
    title: str
    url: str
    resource_type: str
    category: Optional[str] = "General"

class SearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 5

@router.get("/", response_model=List[ResourceResponse])
async def list_resources(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """List all resources for a particular user, with updated presigned URLs for S3 assets."""
    stmt = select(StudyResource).where(StudyResource.user_id == user_id).order_by(desc(StudyResource.id))
    result = await db.execute(stmt)
    resources = result.scalars().all()
    
    # We convert models to dict or create response objects to update URLs
    final_resources = []
    bucket_hostname = f"{s3_service.bucket_name}.s3"
    
    for res in resources:
        res_data = {
            "id": res.id,
            "title": res.title,
            "url": res.url,
            "resource_type": res.resource_type,
            "category": res.category
        }
        
        # If the URL is an S3 URL (static), we swap it for a fresh presigned one
        if bucket_hostname in res.url:
            # Extract key from URL: https://bucket.s3.region.amazonaws.com/key
            try:
                # The key is after the third slash and the domain
                # e.g. https://bucket.s3.region.amazonaws.com/uploads/user/file.pdf
                # Splitting by '.amazonaws.com/' gets the key
                import urllib.parse
                raw_key = res.url.split(".amazonaws.com/")[-1]
                # Strip query parameters (if URL in DB is a presigned URL somehow)
                raw_key = raw_key.split("?")[0]
                # Unquote to get actual S3 key (e.g. from %20 to space)
                key = urllib.parse.unquote(raw_key)

                presigned_url = s3_service.generate_presigned_url(key)
                if presigned_url:
                    res_data["url"] = presigned_url
            except Exception as e:
                print(f"Error parsing S3 key for presigned URL: {e}")
        
        final_resources.append(res_data)
        
    return final_resources

@router.post("/sync")
async def sync_resources(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Syncs the database with the S3 bucket's files for this user.
    """
    # Find files belonging to this user specifically, or root files in 'uploads/'
    all_s3_keys = s3_service.list_all_files("uploads/")
    s3_keys = []
    for key in all_s3_keys:
        parts = key.split("/")
        if len(parts) == 2:
            # e.g. uploads/filename.ext (no specific user dir, assume legacy/shared)
            s3_keys.append(key)
        elif len(parts) > 2 and parts[1] == user_id:
            # e.g. uploads/c4dO3oV2.../uuid/filename.ext
            s3_keys.append(key)
    
    if not s3_keys:
        return {"status": "success", "new_resources": 0, "message": "No new files found in S3."}

    # Fetch existing resource URLs for this user to avoid duplicates
    stmt = select(StudyResource.url).where(StudyResource.user_id == user_id)
    result = await db.execute(stmt)
    existing_urls = set(result.scalars().all())

    new_count = 0
    bucket_name = s3_service.bucket_name
    region = os.getenv('AWS_S3_REGION_NAME', 'ap-south-1')

    for key in s3_keys:
        # Construct the full S3 URL
        url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{key}"
        
        if url not in existing_urls:
            filename = key.split("/")[-1]
            title = filename.replace(".pdf", "").replace("_", " ").title()
            
            new_res = StudyResource(
                user_id=user_id,
                title=title,
                url=url,
                resource_type="PDF" if key.lower().endswith(".pdf") else "S3 File",
                category="Imported from S3"
            )
            db.add(new_res)
            new_count += 1

    if new_count > 0:
        await db.commit()

    return {
        "status": "success", 
        "new_resources": new_count, 
        "message": f"Successfully imported {new_count} new resources from S3."
    }

@router.post("/", response_model=ResourceResponse)
async def add_resource(
    payload: AddResourceRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Manually add a web link or existing resource."""
    new_res = StudyResource(
        user_id=user_id,
        title=payload.title,
        url=payload.url,
        resource_type=payload.resource_type,
        category=payload.category
    )
    db.add(new_res)
    await db.commit()
    await db.refresh(new_res)
    return new_res

@router.post("/search")
async def semantic_search(
    payload: SearchRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Perform vector similarity search over ResourceChunks using pgvector's <=> operator.
    """
    query_text = payload.query
    query_embeddings = await embed_texts([query_text])
    query_embedding = query_embeddings[0] if query_embeddings else None

    if not query_embedding:
        raise HTTPException(status_code=500, detail="Failed to generate embedding for search query")

    stmt = (
        select(ResourceChunk, StudyResource)
        .join(StudyResource, ResourceChunk.resource_id == StudyResource.id)
        .where(StudyResource.user_id == user_id)
        .order_by(ResourceChunk.embedding.cosine_distance(query_embedding))
        .limit(payload.limit)
    )

    result = await db.execute(stmt)
    matches = result.all()

    response = []
    for chunk, resource in matches:
        response.append({
            "resource_id": resource.id,
            "title": resource.title,
            "url": resource.url,
            "chunk_text": chunk.text,
            "similarity_score": "Match"
        })

    return {"matches": response}

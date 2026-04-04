import uuid
from sqlalchemy import Column, String, Integer, Text, ForeignKey
from pgvector.sqlalchemy import Vector
from app.database import Base

class StudyResource(Base):
    __tablename__ = "study_resources"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True) # Identifier referencing the user (e.g. phone or Firebase user ID)
    title = Column(String)
    url = Column(String) # Link to S3 object key or local path
    resource_type = Column(String)
    category = Column(String)

class ResourceChunk(Base):
    __tablename__ = "resource_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resource_id = Column(String, ForeignKey("study_resources.id", ondelete="CASCADE"), index=True)
    chunk_index = Column(Integer)
    text = Column(Text)
    
    # Nomic-embed-text typically outputs 768 dimensions. Adjust this dimension if you use a different Ollama embedding model.
    embedding = Column(Vector(768)) 

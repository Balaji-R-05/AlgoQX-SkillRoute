import fitz  # PyMuPDF
import os
import ollama
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.resource import ResourceChunk

# Base URL for the self-hosted Ollama server.
# Defaults to localhost if not specified in the environment variables.
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# Set up the Ollama client
client = ollama.Client(host=OLLAMA_BASE_URL)
EMBED_MODEL = "nomic-embed-text" # Based on the plan discussion

def extract_text_chunks(pdf_bytes: bytes, chunk_size: int = 400, overlap: int = 80) -> list[str]:
    """Extract text from PDF bytes and split into overlapping chunks."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    full_text = " ".join(page.get_text() for page in doc)
    words = full_text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks

async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Call self-hosted Ollama to generate embeddings for a list of texts."""
    vectors = []
    # Ollama embeddings can be generated individually or in batches by some wrappers,
    # but the standard python 'ollama' library supports embedding a text list or doing them one by one.
    for text in texts:
        response = client.embeddings(model=EMBED_MODEL, prompt=text)
        vectors.append(response["embedding"])
    return vectors

async def chunk_and_embed(resource_id: str, pdf_bytes: bytes, db: AsyncSession):
    """Chunk the PDF text and generate embeddings, then store in DB."""
    chunks = extract_text_chunks(pdf_bytes)
    
    # If no text was found (e.g. image-only PDF), we can handle or skip
    if not chunks:
        return
        
    vectors = await embed_texts(chunks)

    new_chunks = []
    for idx, (chunk_text, vector) in enumerate(zip(chunks, vectors)):
        chunk = ResourceChunk(
            resource_id=resource_id,
            chunk_index=idx,
            text=chunk_text,
            embedding=vector,
        )
        new_chunks.append(chunk)
        
    db.add_all(new_chunks)
    await db.commit()
    
async def semantic_search(user_id: str, query: str, top_k: int = 5, db: AsyncSession = None):
    """Example search stub utilizing PostgreSQL's pgvector operator <=>."""
    # Generate embedding for the query
    q_response = client.embeddings(model=EMBED_MODEL, prompt=query)
    q_vec = q_response["embedding"]
    
    # SQLAlchemy query with the vector operator (Cosine distance)
    from sqlalchemy import text
    stmt = text(f"""
        SELECT rc.text, r.title, r.id,
               1 - (rc.embedding <=> :qvec) AS similarity
        FROM resource_chunks rc
        JOIN study_resources r ON r.id = rc.resource_id
        WHERE r.user_id = :uid
        ORDER BY rc.embedding <=> :qvec
        LIMIT :top_k
    """)
    
    result = await db.execute(stmt, {"qvec": str(q_vec), "uid": user_id, "top_k": top_k})
    return result.fetchall()

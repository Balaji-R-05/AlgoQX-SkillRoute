"""
teaching_service.py — Migrated from AI/Nephele_ragChatbot/Teachng_RAG.py
RAG-based teaching assistant: load resource → teach lesson → answer doubts
Adapted for integration into SkillRoute main backend.
Uses Groq for LLM (reliability) with Ollama fallback.
"""
import os
import re
import uuid
import asyncio
from typing import Optional, List

import openai
import edge_tts
from dotenv import load_dotenv

load_dotenv()

# ── CONFIG ──────────────────────────────────────────────────────────────────

AUDIO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "audio_files")
os.makedirs(AUDIO_DIR, exist_ok=True)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://100.87.204.58:11434")
HF_TOKEN = os.getenv("HUGGINGFACE_API_KEY", os.getenv("HF_TOKEN", ""))
TTS_VOICE = "en-US-AriaNeural"

# Per-user session storage (in-memory for hackathon, keyed by user_id+resource_id)
_sessions = {}


class TeachingSession:
    """Holds the RAG state for a single user-resource pair."""

    def __init__(self):
        self.chunks: List[str] = []
        self.lesson_text: str = ""
        self.source_name: str = ""

    def retrieve(self, query: str, top_k: int = 5) -> List[str]:
        """Simple keyword-based retrieval from chunks (no vector DB needed for hackathon)."""
        if not self.chunks:
            return []
        query_words = set(query.lower().split())
        scored = []
        for chunk in self.chunks:
            chunk_words = set(chunk.lower().split())
            overlap = len(query_words & chunk_words)
            scored.append((overlap, chunk))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [c for _, c in scored[:top_k]]


def _get_llm_client():
    """Get Groq client (primary) or Ollama fallback."""
    if GROQ_API_KEY:
        return openai.OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=GROQ_API_KEY,
        ), "llama-3.1-8b-instant"
    return openai.OpenAI(
        base_url=f"{OLLAMA_BASE_URL}/v1",
        api_key="ollama-local",
    ), "llama3"


def _call_llm(prompt: str) -> str:
    client, model = _get_llm_client()
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=2000,
        )
        return resp.choices[0].message.content or ""
    except Exception as e:
        return f"I'm having trouble generating a response right now. Error: {str(e)[:100]}"


def _chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Simple character-based chunking with overlap."""
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks


def _clean_for_speech(text: str) -> str:
    text = re.sub(r"[\*\#]", "", text)
    text = re.sub(r"--+", " ", text)
    text = re.sub(r":\s", ". ", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


# ── PUBLIC API ──────────────────────────────────────────────────────────────

def get_session_key(user_id: str, resource_id: str) -> str:
    return f"{user_id}:{resource_id}"


def load_document(user_id: str, resource_id: str, text: str, source_name: str) -> dict:
    """Ingest document text into a teaching session."""
    key = get_session_key(user_id, resource_id)
    session = TeachingSession()
    session.source_name = source_name
    session.chunks = _chunk_text(text)
    _sessions[key] = session
    return {"success": True, "chunks": len(session.chunks), "source": source_name}


def generate_lesson(user_id: str, resource_id: str, topic: str) -> dict:
    """Generate a lesson from the loaded resource on the given topic."""
    key = get_session_key(user_id, resource_id)
    session = _sessions.get(key)
    if not session or not session.chunks:
        return {"success": False, "error": "No document loaded. Please load a resource first."}

    relevant = session.retrieve(topic)
    if not relevant:
        return {"success": False, "error": "No relevant content found for this topic."}

    context = "\n\n".join(relevant)
    prompt = f"""You are Nephele, an expert and passionate teacher.
Create an engaging, well-structured spoken lesson about "{topic}" using the provided reference material.

Reference Material:
{context}

Instructions:
1. Open with a warm, friendly greeting.
2. Break the lesson into 3-5 clear sections with natural headings.
3. Use simple analogies, real-world examples, and conversational language.
4. Summarize key takeaways at the end.
5. Close with an encouraging sign-off inviting questions.
6. Keep it suitable for a 2-3 minute spoken narration.
7. Do NOT use markdown formatting symbols. Write in plain, natural sentences."""

    lesson = _call_llm(prompt)
    if not lesson:
        return {"success": False, "error": "Failed to generate lesson."}

    session.lesson_text = lesson
    return {"success": True, "topic": topic, "lesson": lesson}


def answer_doubt(user_id: str, resource_id: str, question: str) -> dict:
    """Answer a student's doubt using the lesson context + RAG retrieval."""
    key = get_session_key(user_id, resource_id)
    session = _sessions.get(key)
    if not session:
        return {"success": False, "error": "No active session. Load a document first."}

    rag_chunks = session.retrieve(question)
    context = session.lesson_text + "\n\n" + "\n\n".join(rag_chunks)

    prompt = f"""You are Nephele, a patient and knowledgeable teaching assistant.
A student has asked a doubt after their lesson. Answer clearly and conversationally.

Relevant lesson context:
{context}

Student's question: {question}

Instructions:
1. Address the student warmly.
2. Give a clear, accurate answer grounded in the context.
3. If context is insufficient, say so honestly.
4. Keep under 200 words and suitable for spoken narration.
5. Do NOT use markdown symbols. Write in plain speech."""

    answer_text = _call_llm(prompt)
    return {"success": True, "question": question, "answer": answer_text}


def ask_general_doubt(user_id: str, question: str) -> dict:
    """Answer a student's doubt using general knowledge (no RAG)."""
    prompt = f"""You are Nephele, a patient and knowledgeable teaching assistant.
A student has asked a general academic question. Answer clearly and conversationally.

Student's question: {question}

Instructions:
1. Address the student warmly.
2. Give a clear, accurate, and structured answer.
3. Keep it under 200 words and suitable for spoken narration.
4. Do NOT use markdown symbols. Write in plain speech."""

    answer_text = _call_llm(prompt)
    return {"success": True, "question": question, "answer": answer_text}


async def synthesize_audio(text: str) -> Optional[str]:
    """Generate TTS audio from text, returns filename or None."""
    cleaned = _clean_for_speech(text)
    if not cleaned:
        return None
    try:
        filename = f"tts_{uuid.uuid4().hex[:12]}.mp3"
        filepath = os.path.join(AUDIO_DIR, filename)
        comm = edge_tts.Communicate(cleaned, TTS_VOICE, rate="+0%", volume="+0%")
        await comm.save(filepath)
        return filename
    except Exception:
        return None


def cleanup_audio() -> int:
    """Remove all generated audio files."""
    count = 0
    if os.path.isdir(AUDIO_DIR):
        for f in os.listdir(AUDIO_DIR):
            if f.endswith((".mp3", ".wav")):
                os.remove(os.path.join(AUDIO_DIR, f))
                count += 1
    return count

#!/usr/bin/env python3
"""
Teachng_RAG.py — Nephele 3.0 FastAPI Backend
RAG Teaching Assistant: Document embedding, LLM lesson generation, Edge TTS voice output.
"""

import os
import re
import uuid
import asyncio
from dataclasses import dataclass, field
from typing import List, Optional

from fastapi import FastAPI, Form, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
import openai
import requests
from bs4 import BeautifulSoup
import PyPDF2
import edge_tts
from dotenv import load_dotenv, find_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_chroma import Chroma

# ── ENV ──────────────────────────────────────────────────────────────────────
load_dotenv(find_dotenv(usecwd=True))

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(BASE_DIR, "project_folder", "audio_files")
os.makedirs(AUDIO_DIR, exist_ok=True)


# ── CONFIG ───────────────────────────────────────────────────────────────────
@dataclass
class Config:
    huggingface_api_key: str = field(
        default_factory=lambda: os.getenv(
            "HUGGINGFACE_API_KEY",
            os.getenv("HUGGINGFACEHUB_API_TOKEN", os.getenv("HF_TOKEN", "")),
        )
    )
    ollama_base_url: str = "http://100.87.204.58:11434/v1"
    model_name: str = "gemma4:31b"
    temperature: float = 0.7
    max_tokens: int = 2000
    chunk_size: int = 1000
    chunk_overlap: int = 200
    top_k_docs: int = 5
    tts_voice: str = "en-US-AriaNeural"
    tts_rate: str = "+0%"
    tts_volume: str = "+0%"


# ── DOCUMENT PROCESSOR ──────────────────────────────────────────────────────
class DocumentProcessor:
    @staticmethod
    def load_from_url(url: str) -> str:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "html.parser")
        for tag in soup(["script", "style"]):
            tag.decompose()
        for sel in ["article", "main", ".content", "#content", ".post"]:
            elems = soup.select(sel)
            if elems:
                text = " ".join(e.get_text() for e in elems)
                break
        else:
            text = soup.get_text()
        lines = (line.strip() for line in text.splitlines())
        return " ".join(chunk for chunk in lines if chunk)

    @staticmethod
    def load_from_pdf(file_path: str) -> str:
        text = ""
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += (page.extract_text() or "") + "\n"
        return text.strip()


# ── RAG PIPELINE ─────────────────────────────────────────────────────────────
class RAGPipeline:
    def __init__(self, config: Config):
        self.config = config
        self.embeddings = HuggingFaceEndpointEmbeddings(
            huggingfacehub_api_token=config.huggingface_api_key,
            model="BAAI/bge-m3",
        )
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=config.chunk_size,
            chunk_overlap=config.chunk_overlap,
            length_function=len,
        )
        self.vectorstore = None

    def ingest(self, text: str, source: str = "document") -> int:
        chunks = self.splitter.split_text(text)
        docs = [
            Document(page_content=c, metadata={"source": source, "chunk_id": i})
            for i, c in enumerate(chunks)
        ]
        self.vectorstore = Chroma.from_documents(
            documents=docs, embedding=self.embeddings
        )
        return len(docs)

    def retrieve(self, query: str) -> List[str]:
        if not self.vectorstore:
            return []
        results = self.vectorstore.similarity_search(query, k=self.config.top_k_docs)
        return [doc.page_content for doc in results]


# ── LLM PROVIDER ─────────────────────────────────────────────────────────────
class LLMProvider:
    def __init__(self, config: Config):
        self.config = config
        self.client = openai.OpenAI(
            base_url=config.ollama_base_url, api_key="ollama-local"
        )

    def _call(self, prompt: str) -> str:
        resp = self.client.chat.completions.create(
            model=self.config.model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
        )
        return resp.choices[0].message.content

    def generate_lesson(self, topic: str, context: str) -> str:
        prompt = f"""You are Nephele, an expert and passionate teacher.
Your task is to create an engaging, well-structured spoken lesson about "{topic}" using the provided reference material.

Reference Material:
{context}

Instructions:
1. Open with a warm, friendly greeting that sets the stage.
2. Break the lesson into 3-5 clear sections. Lead each section with a bold heading idea spoken naturally. Do not use markdown symbols.
3. Use simple analogies, real-world examples, and conversational language as if speaking face-to-face to a curious student.
4. Summarise the key takeaways at the end.
5. Close with an encouraging sign-off inviting questions.
6. Keep the total length suitable for a 2-3 minute spoken narration.
7. Do NOT use markdown formatting symbols like **, ##, --, or colons for labels. Write in plain, natural sentences suitable for text-to-speech.
"""
        return self._call(prompt)

    def answer_doubt(self, question: str, context: str) -> str:
        prompt = f"""You are Nephele, a patient and knowledgeable teaching assistant.
A student has just asked a doubt after their lesson. Answer it clearly and conversationally.

Relevant lesson context:
{context}

Student's question: {question}

Instructions:
1. Address the student directly and warmly.
2. Give a clear, accurate answer grounded in the provided context.
3. If the context is insufficient, say so honestly and suggest what they could explore.
4. Keep the answer concise, under 200 words, and suitable for spoken narration.
5. Do NOT use markdown symbols like **, ##, --, or colons for labels. Write in plain speech.
"""
        return self._call(prompt)


# ── TTS MANAGER ──────────────────────────────────────────────────────────────
class TTSManager:
    def __init__(self, config: Config):
        self.config = config

    @staticmethod
    def clean_for_speech(text: str) -> str:
        """Strip characters that sound awkward when read aloud by TTS."""
        text = re.sub(r"[\*\#]", "", text)          # remove ** and ##
        text = re.sub(r"--+", " ", text)             # replace -- with space
        text = re.sub(r":\s", ". ", text)            # replace : with period
        text = re.sub(r"\s{2,}", " ", text)          # collapse whitespace
        return text.strip()

    async def synthesize(self, text: str) -> Optional[str]:
        """Generate an mp3 file and return its absolute path."""
        cleaned = self.clean_for_speech(text)
        if not cleaned:
            return None
        filename = f"tts_{uuid.uuid4().hex[:12]}.mp3"
        filepath = os.path.join(AUDIO_DIR, filename)
        comm = edge_tts.Communicate(
            cleaned,
            self.config.tts_voice,
            rate=self.config.tts_rate,
            volume=self.config.tts_volume,
        )
        await comm.save(filepath)
        return filepath


# ══════════════════════════════════════════════════════════════════════════════
#  FASTAPI APP
# ══════════════════════════════════════════════════════════════════════════════
config = Config()
rag = RAGPipeline(config)
llm = LLMProvider(config)
tts = TTSManager(config)

# Store the last lesson text in memory
_lesson_text: str = ""

app = FastAPI(title="Nephele 3.0 API", version="3.0")


# ── 1. Load Document ─────────────────────────────────────────────────────────
@app.post("/load_document/")
async def load_document(source: str = Form(...)):
    global _lesson_text
    try:
        if source.startswith("http"):
            raw_text = DocumentProcessor.load_from_url(source)
            source_name = source
        elif os.path.isfile(source):
            raw_text = DocumentProcessor.load_from_pdf(source)
            source_name = os.path.basename(source)
        else:
            return JSONResponse(status_code=400, content={"success": False, "error": "Source must be a URL or valid PDF path"})

        n_chunks = rag.ingest(raw_text, source_name)
        _lesson_text = ""  # reset lesson on new doc
        return {"success": True, "chunks": n_chunks, "source": source_name}
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


# ── 2. Teach Lesson ──────────────────────────────────────────────────────────
@app.post("/teach_lesson/")
async def teach_lesson(topic: str = Form(...)):
    global _lesson_text
    try:
        chunks = rag.retrieve(topic)
        if not chunks:
            return {"success": False, "lesson": "", "audio_file": None, "error": "No relevant content found in document."}

        context = "\n\n".join(chunks)
        lesson = llm.generate_lesson(topic, context)
        if not lesson:
            return {"success": False, "lesson": "", "audio_file": None, "error": "LLM returned empty lesson."}

        _lesson_text = lesson

        # Generate voice
        audio_path = await tts.synthesize(lesson)
        audio_filename = os.path.basename(audio_path) if audio_path else None

        return {
            "success": True,
            "topic": topic,
            "lesson": lesson,
            "audio_file": audio_filename,
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


# ── 3. Ask Doubt ─────────────────────────────────────────────────────────────
@app.post("/doubt/")
async def doubt(question: str = Form(...)):
    try:
        rag_chunks = rag.retrieve(question)
        context = _lesson_text + "\n\n" + "\n\n".join(rag_chunks)
        answer = llm.answer_doubt(question, context)

        # Generate voice
        audio_path = await tts.synthesize(answer) if answer else None
        audio_filename = os.path.basename(audio_path) if audio_path else None

        return {
            "success": True,
            "question": question,
            "answer": answer,
            "audio_file": audio_filename,
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


# ── 4. Serve Audio Files ─────────────────────────────────────────────────────
@app.get("/audio/{filename}")
def get_audio(filename: str):
    filepath = os.path.join(AUDIO_DIR, filename)
    if not os.path.isfile(filepath):
        return JSONResponse(status_code=404, content={"error": "File not found"})
    return FileResponse(filepath, media_type="audio/mpeg")


# ── 5. Cleanup ────────────────────────────────────────────────────────────────
@app.post("/cleanup/")
def cleanup_audio():
    count = 0
    for f in os.listdir(AUDIO_DIR):
        if f.endswith((".mp3", ".wav")):
            os.remove(os.path.join(AUDIO_DIR, f))
            count += 1
    return {"cleaned": count}

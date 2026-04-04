# interview.py
# =============================================================================
# AI-Assisted Interview Backend — Single-File FastAPI Application
# =============================================================================
# Requirements:
# pip install fastapi uvicorn groq pdfplumber python-multipart pydantic
#
# Run server:
# uvicorn interview:app --reload
#
# This backend is intended to be connected later to streamlit_app.py
# =============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# 1. IMPORTS
# ─────────────────────────────────────────────────────────────────────────────
from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from dotenv import load_dotenv
load_dotenv()
import pdfplumber
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel, Field

groq_api=os.getenv("Groq_Api_key")

# ─────────────────────────────────────────────────────────────────────────────
# 2. CONFIG
# ─────────────────────────────────────────────────────────────────────────────
MODEL_NAME: str = "llama-3.1-8b-instant"
MAX_QUESTIONS: int = 15
MAX_STRIKES: int = 5
PLAGIARISM_PENALTY: float = 0.30  # 30 % reduction on flagged answers
TRANSCRIPTS_DIR: str = "transcripts"
DIFFICULTY_LEVELS: list[str] = ["EASY", "MEDIUM", "HARD"]

# Ensure transcripts directory exists
Path(TRANSCRIPTS_DIR).mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# 3. FASTAPI APP SETUP
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI Interview Backend",
    description="Production-ready AI-assisted interview engine using Groq + LLaMA 3.1",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# 4. PYDANTIC MODELS
# ─────────────────────────────────────────────────────────────────────────────

class AnswerRequest(BaseModel):
    """Request body for submitting an answer."""
    session_id: str
    answer: str


class TranscriptEntry(BaseModel):
    """Single Q&A round stored in the session transcript."""
    question_number: int
    question: str
    topic: str
    difficulty: str
    answer: str
    score: int = 0
    feedback: str = ""
    plagiarism_flag: bool = False
    plagiarism_reason: str = ""
    is_strike: bool = False


class FinalReport(BaseModel):
    """Final performance report generated after interview completion."""
    final_score: int = 0
    summary: str = ""
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    topic_breakdown: list[dict[str, Any]] = Field(default_factory=list)


class SessionState(BaseModel):
    """In-memory state for a single interview session."""
    session_id: str
    candidate_name: str = "Candidate"
    resume_text: str = ""
    skill_text: str = ""
    extracted_profile_summary: str = ""
    current_difficulty: str = "MEDIUM"
    strikes: int = 0
    question_count: int = 0
    total_raw_score: float = 0.0
    max_questions: int = MAX_QUESTIONS
    status: str = "active"  # active | completed
    created_at: str = ""
    asked_questions: list[str] = Field(default_factory=list)
    asked_topics: list[str] = Field(default_factory=list)
    answers: list[str] = Field(default_factory=list)
    transcript: list[TranscriptEntry] = Field(default_factory=list)
    final_report: Optional[FinalReport] = None
    current_question: str = ""
    current_topic: str = ""
    completion_reason: str = ""
    transcript_file: str = ""


class StartInterviewResponse(BaseModel):
    session_id: str
    candidate_name: str
    initial_difficulty: str
    strikes: int
    question_count: int
    question: str
    topic: str
    status: str


class AnswerResponse(BaseModel):
    session_id: str
    status: str
    strikes: int
    question_score: Optional[int] = None
    feedback: Optional[str] = None
    plagiarism_flag: bool = False
    plagiarism_reason: str = ""
    difficulty_before: Optional[str] = None
    difficulty_after: Optional[str] = None
    next_question: Optional[str] = None
    next_topic: Optional[str] = None
    question_count: int = 0
    final_score: Optional[int] = None
    reason: Optional[str] = None
    summary: Optional[str] = None
    strengths: Optional[list[str]] = None
    improvements: Optional[list[str]] = None
    transcript_file: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# 5. IN-MEMORY SESSION STORE
# ─────────────────────────────────────────────────────────────────────────────
sessions: dict[str, SessionState] = {}

# ─────────────────────────────────────────────────────────────────────────────
# 6. UTILITY FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def _get_groq_client() -> Groq:
    """Return a configured Groq client; raise if API key is missing."""
    if not groq_api:
        raise HTTPException(
            status_code=500,
            detail="Groq_Api_key is not set in your .env file.",
        )
    return Groq(api_key=groq_api)


def sanitize_filename(name: str) -> str:
    """Remove characters unsafe for filenames."""
    return re.sub(r"[^a-zA-Z0-9_\- ]", "", name).strip().replace(" ", "_")


def _safe_json_parse(text: str) -> dict:
    """Attempt to extract and parse a JSON object from raw LLM text."""
    text = text.strip()
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try to find JSON block inside markdown fences
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    # Try to find first { ... } substring
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return {}


# ─────────────────────────────────────────────────────────────────────────────
# 7. FILE PARSING FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def parse_resume(file: UploadFile) -> str:
    """Extract text from a PDF or TXT resume upload.

    Returns the full extracted text.
    """
    filename = (file.filename or "").lower()
    content = file.file.read()

    if filename.endswith(".pdf"):
        text_parts: list[str] = []
        import io
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        return "\n".join(text_parts)

    if filename.endswith(".txt"):
        return content.decode("utf-8", errors="replace")

    raise HTTPException(
        status_code=400,
        detail=f"Unsupported resume file type: {filename}. Only .pdf and .txt are accepted.",
    )


def parse_skill_file(file: UploadFile) -> str:
    """Read a plain-text skill-section file."""
    content = file.file.read()
    return content.decode("utf-8", errors="replace")


def extract_candidate_name(resume_text: str) -> str:
    """Heuristically extract the candidate name from the first few lines.

    Falls back to 'Candidate' if no plausible name is found.
    """
    lines = [ln.strip() for ln in resume_text.split("\n") if ln.strip()]
    if not lines:
        return "Candidate"
    # The very first non-empty line is often the candidate's name
    first_line = lines[0]
    # Simple heuristic: if the first line is <=60 chars and contains no common
    # heading keywords, treat it as the name.
    skip_keywords = [
        "resume", "curriculum", "cv", "objective", "summary", "profile",
        "experience", "education", "skills", "contact",
    ]
    if len(first_line) <= 60 and not any(kw in first_line.lower() for kw in skip_keywords):
        return first_line.title()
    return "Candidate"


# ─────────────────────────────────────────────────────────────────────────────
# 8. GROQ LLM HELPER
# ─────────────────────────────────────────────────────────────────────────────

def call_groq(messages: list[dict[str, str]], temperature: float = 0.2) -> str:
    """Send a chat-completion request to Groq and return the assistant text.

    Raises HTTPException on failure.
    """
    client = _get_groq_client()
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            temperature=temperature,
            max_tokens=2048,
        )
        return response.choices[0].message.content or ""
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Groq API call failed: {exc}",
        )


def call_groq_json(
    messages: list[dict[str, str]],
    temperature: float = 0.1,
    fallback: dict | None = None,
) -> dict:
    """Call Groq expecting JSON output. Retries once on parse failure."""
    raw = call_groq(messages, temperature=temperature)
    parsed = _safe_json_parse(raw)
    if parsed:
        return parsed

    # Retry with a stricter repair prompt
    repair_messages = messages + [
        {"role": "assistant", "content": raw},
        {
            "role": "user",
            "content": (
                "Your previous response was not valid JSON. "
                "Please return ONLY a valid JSON object with no extra text or markdown."
            ),
        },
    ]
    raw_retry = call_groq(repair_messages, temperature=0.0)
    parsed_retry = _safe_json_parse(raw_retry)
    if parsed_retry:
        return parsed_retry

    # Deterministic fallback
    if fallback is not None:
        return fallback
    return {}


# ─────────────────────────────────────────────────────────────────────────────
# 9. AGENT PROMPT STRINGS
# ─────────────────────────────────────────────────────────────────────────────

PROFILE_SUMMARY_SYSTEM = (
    "You are a resume analysis expert. Given a candidate's resume text and skill "
    "section, produce a concise profile summary in JSON with the following keys:\n"
    '  "name": best-guess candidate name (string),\n'
    '  "level": one of "beginner", "intermediate", "advanced",\n'
    '  "domains": list of technology domains,\n'
    '  "key_skills": list of top skills,\n'
    '  "achievements": list of notable achievements,\n'
    '  "summary": short paragraph summarizing the profile.\n'
    "Return ONLY valid JSON."
)

QUESTION_GENERATOR_SYSTEM = (
    "You are a senior technical interviewer. Based on the candidate's resume and "
    "skill summary, generate exactly one relevant interview question at the "
    "specified difficulty level. Avoid repeating already covered topics. Keep the "
    "question crisp, specific, and interview-style.\n"
    'Return JSON only with keys: "question", "topic".'
)

ANSWER_EVALUATOR_SYSTEM = (
    "You are an expert interview answer evaluator. Evaluate the candidate's answer "
    "to the given interview question. Be fair but rigorous.\n\n"
    "Return strict JSON with these keys:\n"
    '  "score": integer 0 to 10,\n'
    '  "feedback": short constructive feedback string,\n'
    '  "adjust_difficulty": one of "UP", "DOWN", or "SAME",\n'
    '  "plagiarism_flag": boolean — true if the answer seems copied, too textbook-like, '
    "unnaturally polished, or not conversational for a live interview,\n"
    '  "plagiarism_reason": string explaining why (empty if no plagiarism),\n'
    '  "confidence_label": one of "weak", "moderate", "strong".\n\n'
    "Return ONLY valid JSON."
)

FINAL_REPORT_SYSTEM = (
    "You are an expert interview performance analyst. Given the full transcript of "
    "an interview, compute a comprehensive performance report.\n\n"
    "Return strict JSON with these keys:\n"
    '  "final_score": integer 0 to 100,\n'
    '  "summary": overall performance paragraph,\n'
    '  "strengths": list of strength points,\n'
    '  "improvements": list of improvement suggestions,\n'
    '  "topic_breakdown": list of objects with keys "topic", "score", "notes".\n\n'
    "Return ONLY valid JSON."
)


# ─────────────────────────────────────────────────────────────────────────────
# 10. AGENT FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def agent_profile_summary(resume_text: str, skill_text: str) -> dict:
    """Analyse the candidate's resume and skills to determine profile level."""
    messages = [
        {"role": "system", "content": PROFILE_SUMMARY_SYSTEM},
        {
            "role": "user",
            "content": (
                f"=== RESUME ===\n{resume_text[:6000]}\n\n"
                f"=== SKILL SECTION ===\n{skill_text[:3000]}"
            ),
        },
    ]
    fallback = {
        "name": "Candidate",
        "level": "intermediate",
        "domains": [],
        "key_skills": [],
        "achievements": [],
        "summary": "Profile analysis unavailable.",
    }
    return call_groq_json(messages, temperature=0.2, fallback=fallback)


def agent_generate_question(session: SessionState) -> dict:
    """Generate a single interview question respecting difficulty and history."""
    covered = ", ".join(session.asked_topics) if session.asked_topics else "none yet"
    messages = [
        {"role": "system", "content": QUESTION_GENERATOR_SYSTEM},
        {
            "role": "user",
            "content": (
                f"Candidate profile:\n{session.extracted_profile_summary}\n\n"
                f"Current difficulty: {session.current_difficulty}\n"
                f"Topics already covered: {covered}\n\n"
                "Generate the next interview question."
            ),
        },
    ]
    fallback = {
        "question": "Can you describe a challenging project you worked on and the technologies you used?",
        "topic": "General",
    }
    return call_groq_json(messages, temperature=0.5, fallback=fallback)


def agent_evaluate_answer(
    question: str,
    answer: str,
    difficulty: str,
    profile_summary: str,
) -> dict:
    """Evaluate a candidate answer and return scoring + plagiarism check."""
    messages = [
        {"role": "system", "content": ANSWER_EVALUATOR_SYSTEM},
        {
            "role": "user",
            "content": (
                f"Candidate profile:\n{profile_summary}\n\n"
                f"Difficulty: {difficulty}\n"
                f"Question: {question}\n"
                f"Candidate's Answer: {answer}\n\n"
                "Evaluate this answer."
            ),
        },
    ]
    fallback = {
        "score": 0,
        "feedback": "Unable to evaluate. Defaulting to zero.",
        "adjust_difficulty": "SAME",
        "plagiarism_flag": False,
        "plagiarism_reason": "",
        "confidence_label": "weak",
    }
    result = call_groq_json(messages, temperature=0.1, fallback=fallback)
    # Normalise keys
    result.setdefault("score", 0)
    result.setdefault("feedback", "")
    result.setdefault("adjust_difficulty", "SAME")
    result.setdefault("plagiarism_flag", False)
    result.setdefault("plagiarism_reason", "")
    result.setdefault("confidence_label", "weak")
    # Ensure score is an int in range
    try:
        result["score"] = max(0, min(10, int(result["score"])))
    except (ValueError, TypeError):
        result["score"] = 0
    return result


def agent_final_report(session: SessionState) -> dict:
    """Generate the final performance report from the full transcript."""
    transcript_text = _build_transcript_text(session)
    messages = [
        {"role": "system", "content": FINAL_REPORT_SYSTEM},
        {
            "role": "user",
            "content": (
                f"Candidate: {session.candidate_name}\n"
                f"Questions asked: {session.question_count}\n"
                f"Strikes: {session.strikes}\n\n"
                f"=== FULL TRANSCRIPT ===\n{transcript_text}\n\n"
                "Generate the final performance report."
            ),
        },
    ]
    fallback = {
        "final_score": 0,
        "summary": "Report generation failed.",
        "strengths": [],
        "improvements": [],
        "topic_breakdown": [],
    }
    result = call_groq_json(messages, temperature=0.2, fallback=fallback)
    # Ensure final_score is int 0-100
    try:
        result["final_score"] = max(0, min(100, int(result.get("final_score", 0))))
    except (ValueError, TypeError):
        result["final_score"] = 0
    return result


# ─────────────────────────────────────────────────────────────────────────────
# 11. DIFFICULTY HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def determine_initial_difficulty(profile: dict) -> str:
    """Pick starting difficulty based on profile level."""
    level = (profile.get("level") or "intermediate").lower()
    if level in ("beginner", "junior", "entry"):
        return "EASY"
    if level in ("advanced", "senior", "expert", "lead"):
        return "HARD"
    return "MEDIUM"


def adjust_difficulty(current: str, direction: str) -> str:
    """Move difficulty UP / DOWN / SAME within bounds."""
    direction = (direction or "SAME").upper()
    idx = DIFFICULTY_LEVELS.index(current) if current in DIFFICULTY_LEVELS else 1
    if direction == "UP":
        idx = min(idx + 1, len(DIFFICULTY_LEVELS) - 1)
    elif direction == "DOWN":
        idx = max(idx - 1, 0)
    return DIFFICULTY_LEVELS[idx]


def is_strike_answer(answer: str) -> bool:
    """Return True if the answer counts as a strike (skip / idk)."""
    cleaned = answer.strip().lower()
    if not cleaned:
        return True
    strike_phrases = {"idk", "i don't know", "i dont know"}
    return cleaned in strike_phrases


# ─────────────────────────────────────────────────────────────────────────────
# 12. TRANSCRIPT WRITER
# ─────────────────────────────────────────────────────────────────────────────

def _build_transcript_text(session: SessionState) -> str:
    """Build a human-readable transcript string from the session."""
    lines: list[str] = []
    for entry in session.transcript:
        lines.append(f"Q{entry.question_number} [{entry.difficulty}] (Topic: {entry.topic})")
        lines.append(f"  Question : {entry.question}")
        lines.append(f"  Answer   : {entry.answer}")
        if entry.is_strike:
            lines.append("  ** STRIKE **")
        else:
            lines.append(f"  Score    : {entry.score}/10")
            lines.append(f"  Feedback : {entry.feedback}")
            if entry.plagiarism_flag:
                lines.append(f"  ⚠ Plagiarism detected: {entry.plagiarism_reason}")
        lines.append("")
    return "\n".join(lines)


def save_transcript(session: SessionState) -> str:
    """Persist the full interview transcript to a .txt file and return the path."""
    safe_name = sanitize_filename(session.candidate_name) or "Candidate"
    date_str = datetime.now().strftime("%Y-%m-%d")
    filename = f"{safe_name}_interview_{date_str}.txt"
    filepath = os.path.join(TRANSCRIPTS_DIR, filename)

    report = session.final_report
    with open(filepath, "w", encoding="utf-8") as fh:
        fh.write("=" * 70 + "\n")
        fh.write("AI INTERVIEW TRANSCRIPT\n")
        fh.write("=" * 70 + "\n\n")
        fh.write(f"Candidate     : {session.candidate_name}\n")
        fh.write(f"Date / Time   : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        fh.write(f"Questions     : {session.question_count}\n")
        fh.write(f"Strikes       : {session.strikes}\n")
        fh.write(f"End Reason    : {session.completion_reason}\n")
        if report:
            fh.write(f"Final Score   : {report.final_score} / 100\n")
        fh.write("\n" + "-" * 70 + "\n")
        fh.write("QUESTION & ANSWER LOG\n")
        fh.write("-" * 70 + "\n\n")
        fh.write(_build_transcript_text(session))

        if report:
            fh.write("\n" + "-" * 70 + "\n")
            fh.write("FINAL REPORT\n")
            fh.write("-" * 70 + "\n\n")
            fh.write(f"Score   : {report.final_score} / 100\n")
            fh.write(f"Summary : {report.summary}\n\n")
            fh.write("Strengths:\n")
            for s in report.strengths:
                fh.write(f"  • {s}\n")
            fh.write("\nImprovement Suggestions:\n")
            for imp in report.improvements:
                fh.write(f"  • {imp}\n")
            fh.write("\nTopic Breakdown:\n")
            for tb in report.topic_breakdown:
                fh.write(f"  - {tb}\n")

        fh.write("\n" + "=" * 70 + "\n")
        fh.write("END OF TRANSCRIPT\n")
        fh.write("=" * 70 + "\n")

    return filepath


# ─────────────────────────────────────────────────────────────────────────────
# 13. INTERNAL HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _finalize_interview(session: SessionState, reason: str) -> None:
    """Finalize session: generate report, save transcript, update state."""
    session.status = "completed"
    session.completion_reason = reason

    # Generate final report via LLM
    report_data = agent_final_report(session)

    # Also compute a raw-data-based score as a cross-check
    if session.question_count > 0:
        raw_pct = (session.total_raw_score / (session.question_count * 10)) * 100
    else:
        raw_pct = 0.0

    # Prefer LLM score if it seems reasonable; otherwise use computed one
    llm_score = report_data.get("final_score", 0)
    final_score = llm_score if llm_score > 0 else int(round(raw_pct))
    report_data["final_score"] = max(0, min(100, final_score))

    session.final_report = FinalReport(**report_data)
    session.transcript_file = save_transcript(session)


def _get_session(session_id: str) -> SessionState:
    """Retrieve a session or raise 404."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return session


# ─────────────────────────────────────────────────────────────────────────────
# 14. API ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    """Health-check landing page."""
    return {
        "message": "AI Interview Backend Running",
        "model": MODEL_NAME,
        "frontend": "Connect this backend to streamlit_app.py",
    }


@app.get("/health")
async def health():
    """Detailed health status."""
    api_key_set = bool(groq_api)
    return {
        "status": "healthy" if api_key_set else "degraded",
        "groq_api_key_configured": api_key_set,
        "model": MODEL_NAME,
        "active_sessions": len(sessions),
    }


@app.post("/interview/start", response_model=StartInterviewResponse)
async def start_interview(
    resume_file: UploadFile = File(...),
    skill_file: UploadFile = File(...),
):
    """Create a new interview session, analyse the candidate, and return the first question."""

    # --- Parse files ---
    resume_text = parse_resume(resume_file)
    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Resume file is empty or could not be parsed.")

    skill_text = parse_skill_file(skill_file)
    if not skill_text.strip():
        raise HTTPException(status_code=400, detail="Skill section file is empty.")

    # --- Profile analysis ---
    profile = agent_profile_summary(resume_text, skill_text)
    candidate_name = profile.get("name") or extract_candidate_name(resume_text)
    initial_difficulty = determine_initial_difficulty(profile)
    profile_summary = profile.get("summary", "")

    # --- Create session ---
    session_id = str(uuid.uuid4())
    session = SessionState(
        session_id=session_id,
        candidate_name=candidate_name,
        resume_text=resume_text,
        skill_text=skill_text,
        extracted_profile_summary=json.dumps(profile, indent=2),
        current_difficulty=initial_difficulty,
        created_at=datetime.now().isoformat(),
    )

    # --- Generate first question ---
    q_data = agent_generate_question(session)
    question_text = q_data.get("question", "Tell me about yourself and your technical background.")
    topic = q_data.get("topic", "General")

    session.current_question = question_text
    session.current_topic = topic
    session.question_count = 1
    session.asked_questions.append(question_text)
    session.asked_topics.append(topic)

    sessions[session_id] = session

    return StartInterviewResponse(
        session_id=session_id,
        candidate_name=candidate_name,
        initial_difficulty=initial_difficulty,
        strikes=0,
        question_count=1,
        question=question_text,
        topic=topic,
        status="active",
    )


@app.post("/interview/answer", response_model=AnswerResponse)
async def submit_answer(payload: AnswerRequest):
    """Accept an answer, evaluate it, adjust difficulty, and return the next question or final report."""
    session = _get_session(payload.session_id)

    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Interview already completed.")

    answer = payload.answer
    question = session.current_question
    topic = session.current_topic
    difficulty_before = session.current_difficulty

    # --- Strike check ---
    strike = is_strike_answer(answer)

    if strike:
        session.strikes += 1
        entry = TranscriptEntry(
            question_number=session.question_count,
            question=question,
            topic=topic,
            difficulty=difficulty_before,
            answer=answer if answer.strip() else "(no answer)",
            is_strike=True,
        )
        session.transcript.append(entry)
        session.answers.append(answer)

        # Check end conditions
        if session.strikes >= MAX_STRIKES:
            _finalize_interview(session, "max_strikes_reached")
            rpt = session.final_report
            return AnswerResponse(
                session_id=session.session_id,
                status="completed",
                strikes=session.strikes,
                question_count=session.question_count,
                reason="max_strikes_reached",
                final_score=rpt.final_score if rpt else 0,
                summary=rpt.summary if rpt else "",
                strengths=rpt.strengths if rpt else [],
                improvements=rpt.improvements if rpt else [],
                transcript_file=session.transcript_file,
            )

        # Generate next question
        session.question_count += 1
        q_data = agent_generate_question(session)
        next_q = q_data.get("question", "Could you elaborate on another area of your expertise?")
        next_t = q_data.get("topic", "General")
        session.current_question = next_q
        session.current_topic = next_t
        session.asked_questions.append(next_q)
        session.asked_topics.append(next_t)

        return AnswerResponse(
            session_id=session.session_id,
            status="active",
            strikes=session.strikes,
            question_score=0,
            feedback="Answer counted as a strike.",
            difficulty_before=difficulty_before,
            difficulty_after=session.current_difficulty,
            next_question=next_q,
            next_topic=next_t,
            question_count=session.question_count,
        )

    # --- Evaluate answer ---
    eval_result = agent_evaluate_answer(
        question=question,
        answer=answer,
        difficulty=difficulty_before,
        profile_summary=session.extracted_profile_summary,
    )

    raw_score: int = eval_result["score"]
    plagiarism_flag: bool = bool(eval_result.get("plagiarism_flag", False))
    plagiarism_reason: str = eval_result.get("plagiarism_reason", "")

    # Apply plagiarism penalty
    effective_score = raw_score
    if plagiarism_flag:
        effective_score = max(0, int(raw_score * (1 - PLAGIARISM_PENALTY)))

    session.total_raw_score += effective_score

    # Adjust difficulty
    new_difficulty = adjust_difficulty(
        session.current_difficulty,
        eval_result.get("adjust_difficulty", "SAME"),
    )
    session.current_difficulty = new_difficulty

    entry = TranscriptEntry(
        question_number=session.question_count,
        question=question,
        topic=topic,
        difficulty=difficulty_before,
        answer=answer,
        score=effective_score,
        feedback=eval_result.get("feedback", ""),
        plagiarism_flag=plagiarism_flag,
        plagiarism_reason=plagiarism_reason,
    )
    session.transcript.append(entry)
    session.answers.append(answer)

    # Check max questions
    if session.question_count >= MAX_QUESTIONS:
        _finalize_interview(session, "max_questions_reached")
        rpt = session.final_report
        return AnswerResponse(
            session_id=session.session_id,
            status="completed",
            strikes=session.strikes,
            question_score=effective_score,
            feedback=eval_result.get("feedback", ""),
            plagiarism_flag=plagiarism_flag,
            plagiarism_reason=plagiarism_reason,
            difficulty_before=difficulty_before,
            difficulty_after=new_difficulty,
            question_count=session.question_count,
            reason="max_questions_reached",
            final_score=rpt.final_score if rpt else 0,
            summary=rpt.summary if rpt else "",
            strengths=rpt.strengths if rpt else [],
            improvements=rpt.improvements if rpt else [],
            transcript_file=session.transcript_file,
        )

    # Generate next question
    session.question_count += 1
    q_data = agent_generate_question(session)
    next_q = q_data.get("question", "Can you share more about your technical experience?")
    next_t = q_data.get("topic", "General")
    session.current_question = next_q
    session.current_topic = next_t
    session.asked_questions.append(next_q)
    session.asked_topics.append(next_t)

    return AnswerResponse(
        session_id=session.session_id,
        status="active",
        strikes=session.strikes,
        question_score=effective_score,
        feedback=eval_result.get("feedback", ""),
        plagiarism_flag=plagiarism_flag,
        plagiarism_reason=plagiarism_reason,
        difficulty_before=difficulty_before,
        difficulty_after=new_difficulty,
        next_question=next_q,
        next_topic=next_t,
        question_count=session.question_count,
    )


@app.get("/interview/{session_id}")
async def get_session(session_id: str):
    """Fetch current session state."""
    session = _get_session(session_id)
    condensed_transcript = [
        {
            "q": e.question_number,
            "topic": e.topic,
            "difficulty": e.difficulty,
            "score": e.score,
            "strike": e.is_strike,
        }
        for e in session.transcript
    ]
    return {
        "session_id": session.session_id,
        "candidate_name": session.candidate_name,
        "status": session.status,
        "current_difficulty": session.current_difficulty,
        "strikes": session.strikes,
        "question_count": session.question_count,
        "current_question": session.current_question if session.status == "active" else None,
        "current_topic": session.current_topic if session.status == "active" else None,
        "transcript": condensed_transcript,
        "created_at": session.created_at,
    }


@app.get("/interview/{session_id}/report")
async def get_report(session_id: str):
    """Fetch the final report for a completed interview."""
    session = _get_session(session_id)
    if session.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Interview is still in progress. Complete the interview first.",
        )
    if not session.final_report:
        raise HTTPException(status_code=500, detail="Final report is missing.")
    return {
        "session_id": session.session_id,
        "candidate_name": session.candidate_name,
        "final_score": session.final_report.final_score,
        "summary": session.final_report.summary,
        "strengths": session.final_report.strengths,
        "improvements": session.final_report.improvements,
        "topic_breakdown": session.final_report.topic_breakdown,
        "transcript_file": session.transcript_file,
        "strikes": session.strikes,
        "questions_asked": session.question_count,
        "completion_reason": session.completion_reason,
    }


@app.delete("/interview/{session_id}")
async def delete_session(session_id: str):
    """Remove a session from memory."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    del sessions[session_id]
    return {"message": f"Session '{session_id}' deleted.", "status": "ok"}


# ─────────────────────────────────────────────────────────────────────────────
# 15. MAIN BLOCK
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    print("🚀 Starting AI Interview Backend …")
    print(f"   Model : {MODEL_NAME}")
    print(f"   Docs  : http://127.0.0.1:8000/docs")
    uvicorn.run("interview:app", host="0.0.0.0", port=8000, reload=True)

"""
interview_service.py — Migrated from AI/Interview_agent/interview.py
Core interview logic extracted as a service module, adapted for:
  - Postgres persistence (via SQLAlchemy async)
  - Firebase auth (user_id tracking)
  - Groq API (llama-3.1-8b-instant)
  - Feed scores into ReadinessEngine
"""
import json
import os
import re
import io
import uuid
from datetime import datetime
from typing import Optional

import pdfplumber
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# ── CONFIG ──────────────────────────────────────────────────────────────────
MODEL_NAME = "llama-3.1-8b-instant"
MAX_QUESTIONS = 15
MAX_STRIKES = 5
PLAGIARISM_PENALTY = 0.30
DIFFICULTY_LEVELS = ["EASY", "MEDIUM", "HARD"]


def _get_groq_client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY") or os.getenv("Groq_Api_key")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set")
    return Groq(api_key=api_key)


def _safe_json_parse(text: str) -> dict:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return {}


def call_groq(messages: list, temperature: float = 0.2) -> str:
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
        raise RuntimeError(f"Groq API call failed: {exc}")


def call_groq_json(messages: list, temperature: float = 0.1, fallback: dict = None) -> dict:
    raw = call_groq(messages, temperature=temperature)
    parsed = _safe_json_parse(raw)
    if parsed:
        return parsed
    repair_messages = messages + [
        {"role": "assistant", "content": raw},
        {"role": "user", "content": "Your previous response was not valid JSON. Return ONLY valid JSON."},
    ]
    raw_retry = call_groq(repair_messages, temperature=0.0)
    parsed_retry = _safe_json_parse(raw_retry)
    if parsed_retry:
        return parsed_retry
    return fallback or {}


# ── PROMPT STRINGS ──────────────────────────────────────────────────────────

PROFILE_SUMMARY_SYSTEM = (
    "You are a resume analysis expert. Given a candidate's resume text and skill "
    "section, produce a concise profile summary in JSON with keys: "
    '"name", "level" (beginner/intermediate/advanced), "domains", "key_skills", '
    '"achievements", "summary". Return ONLY valid JSON.'
)

QUESTION_GENERATOR_SYSTEM = (
    "You are a senior technical interviewer. Based on the candidate's profile, "
    "generate exactly one relevant interview question at the specified difficulty. "
    "- EASY: Fundamental concepts, syntax, definitions. (e.g. 'What is a decorator?') "
    "- MEDIUM: Practical application, logic, and implementation. (e.g. 'How would you find a cycle in a linked list?') "
    "- HARD: System design, complex problem solving, and architecture. (e.g. 'Design a scalable real-time chat architecture.') "
    "Return JSON only with keys: \"question\", \"topic\"."
)

ANSWER_EVALUATOR_SYSTEM = (
    "You are an expert interview answer evaluator and security analyst. "
    "Evaluate the answer for correctness, depth, and potential 'suspicious' behavior. "
    "Suspicious Behavior (sus) includes: "
    "- AI-like structure (overly perfect formatting, distinct bulleting styles unique to LLMs). "
    "- Copy-pasted documentation or web snippets. "
    "- Answers that feel 'out of character' compared to previous responses. "
    "- Answers that are suspiciously generic or irrelevant but technically correct. "
    "Return strict JSON with keys: "
    '"score" (0-10), "feedback", "adjust_difficulty" (UP/DOWN/SAME), '
    '"plagiarism_flag" (boolean), "plagiarism_reason", '
    '"is_sus" (boolean), "sus_reason" (string), '
    '"confidence_label" (weak/moderate/strong). '
    "Return ONLY valid JSON."
)

FINAL_REPORT_SYSTEM = (
    "You are an expert interview performance analyst. Given the full transcript, "
    "compute a comprehensive performance report. Return strict JSON with keys: "
    '"final_score" (0-100), "summary", "strengths" (list), "improvements" (list), '
    '"topic_breakdown" (list of {topic, score, notes}). Return ONLY valid JSON.'
)


# ── FILE PARSING ────────────────────────────────────────────────────────────

def parse_resume_bytes(content: bytes, filename: str) -> str:
    if filename.lower().endswith(".pdf"):
        text_parts = []
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        return "\n".join(text_parts)
    return content.decode("utf-8", errors="replace")


def extract_candidate_name(resume_text: str) -> str:
    lines = [ln.strip() for ln in resume_text.split("\n") if ln.strip()]
    if not lines:
        return "Candidate"
    first_line = lines[0]
    skip_kw = ["resume", "curriculum", "cv", "objective", "summary", "profile", "experience", "education", "skills"]
    if len(first_line) <= 60 and not any(kw in first_line.lower() for kw in skip_kw):
        return first_line.title()
    return "Candidate"


# ── AGENT FUNCTIONS ─────────────────────────────────────────────────────────

def agent_profile_summary(resume_text: str, skill_text: str) -> dict:
    messages = [
        {"role": "system", "content": PROFILE_SUMMARY_SYSTEM},
        {"role": "user", "content": f"=== RESUME ===\n{resume_text[:6000]}\n\n=== SKILL SECTION ===\n{skill_text[:3000]}"},
    ]
    return call_groq_json(messages, temperature=0.2, fallback={
        "name": "Candidate", "level": "intermediate", "domains": [],
        "key_skills": [], "achievements": [], "summary": "Profile analysis unavailable."
    })


def agent_generate_question(profile_summary: str, difficulty: str, asked_topics: list) -> dict:
    covered = ", ".join(asked_topics) if asked_topics else "none yet"
    messages = [
        {"role": "system", "content": QUESTION_GENERATOR_SYSTEM},
        {"role": "user", "content": (
            f"Candidate profile:\n{profile_summary}\n\n"
            f"Current difficulty: {difficulty}\n"
            f"Topics already covered: {covered}\n\n"
            "Generate the next interview question. "
            "If difficulty is EASY, focus on foundational, entry-level, and conceptual questions. "
            "Return ONLY the question and topic in JSON."
        )},
    ]
    return call_groq_json(messages, temperature=0.5, fallback={
        "question": "Can you describe a challenging project you worked on?",
        "topic": "General"
    })


def agent_evaluate_answer(question: str, answer: str, difficulty: str, profile_summary: str) -> dict:
    messages = [
        {"role": "system", "content": ANSWER_EVALUATOR_SYSTEM},
        {"role": "user", "content": (
            f"Candidate profile:\n{profile_summary}\n\n"
            f"Difficulty: {difficulty}\nQuestion: {question}\n"
            f"Candidate's Answer: {answer}\n\nEvaluate this answer."
        )},
    ]
    result = call_groq_json(messages, temperature=0.1, fallback={
        "score": 0, "feedback": "Unable to evaluate.", "adjust_difficulty": "SAME",
        "plagiarism_flag": False, "plagiarism_reason": "", "confidence_label": "weak"
    })
    result.setdefault("score", 0)
    result.setdefault("feedback", "")
    result.setdefault("adjust_difficulty", "SAME")
    result.setdefault("plagiarism_flag", False)
    result.setdefault("plagiarism_reason", "")
    result.setdefault("is_sus", False)
    result.setdefault("sus_reason", "")
    result.setdefault("confidence_label", "weak")
    try:
        result["score"] = max(0, min(10, int(result["score"])))
    except (ValueError, TypeError):
        result["score"] = 0
    return result


def agent_final_report(candidate_name: str, question_count: int, strikes: int, transcript: list) -> dict:
    transcript_text = _build_transcript_text(transcript)
    messages = [
        {"role": "system", "content": FINAL_REPORT_SYSTEM},
        {"role": "user", "content": (
            f"Candidate: {candidate_name}\nQuestions asked: {question_count}\n"
            f"Strikes: {strikes}\n\n=== FULL TRANSCRIPT ===\n{transcript_text}\n\n"
            "Generate the final performance report."
        )},
    ]
    result = call_groq_json(messages, temperature=0.2, fallback={
        "final_score": 0, "summary": "Report generation failed.",
        "strengths": [], "improvements": [], "topic_breakdown": []
    })
    try:
        result["final_score"] = max(0, min(100, int(result.get("final_score", 0))))
    except (ValueError, TypeError):
        result["final_score"] = 0
    return result


# ── HELPERS ─────────────────────────────────────────────────────────────────

def _build_transcript_text(transcript: list) -> str:
    lines = []
    for entry in transcript:
        lines.append(f"Q{entry.get('question_number', '?')} [{entry.get('difficulty', '?')}] (Topic: {entry.get('topic', '?')})")
        lines.append(f"  Question : {entry.get('question', '')}")
        lines.append(f"  Answer   : {entry.get('answer', '')}")
        if entry.get("is_strike"):
            lines.append("  ** STRIKE **")
        else:
            lines.append(f"  Score    : {entry.get('score', 0)}/10")
            lines.append(f"  Feedback : {entry.get('feedback', '')}")
            if entry.get("plagiarism_flag"):
                lines.append(f"  ⚠ Plagiarism: {entry.get('plagiarism_reason', '')}")
        lines.append("")
    return "\n".join(lines)


def determine_initial_difficulty(profile: dict) -> str:
    level = (profile.get("level") or "intermediate").lower()
    if level in ("beginner", "junior", "entry", "fresher"):
        return "EASY"
    # Even for advanced profiles, start at MEDIUM for a smoother mock experience
    return "MEDIUM"


def adjust_difficulty(current: str, direction: str) -> str:
    direction = (direction or "SAME").upper()
    idx = DIFFICULTY_LEVELS.index(current) if current in DIFFICULTY_LEVELS else 1
    if direction == "UP":
        idx = min(idx + 1, len(DIFFICULTY_LEVELS) - 1)
    elif direction == "DOWN":
        idx = max(idx - 1, 0)
    return DIFFICULTY_LEVELS[idx]


def is_strike_answer(answer: str) -> bool:
    cleaned = answer.strip().lower()
    if not cleaned:
        return True
    return cleaned in {"idk", "i don't know", "i dont know", "skip", "pass"}

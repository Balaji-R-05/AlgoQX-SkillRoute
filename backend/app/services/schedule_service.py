import os
import json
import httpx
from typing import Optional
from datetime import date
import openai

OLLAMA_API_BASE = os.getenv("OLLAMA_API_BASE", "http://100.87.204.58:11434/api")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

SCHEDULE_SYSTEM_PROMPT = """You are SkillRoute StudyPlanner — an AI specialized in creating day-by-day study schedules.

## MISSION
Create a highly structured study plan based on a given event (exam/interview), duration, and daily time availability.

## RULES
- Return ONLY raw JSON. NO markdown. NO code blocks.
- Break the content into logical daily topics.
- Scale the depth based on 'daily_hours' and 'days' provided.
- If it's an 'interview', focus on 'additional_notes' (requirements) and common interview questions.
- If it's an 'exam', focus on the 'syllabus'.
- Format:
{
  "title": "<Plan Title>",
  "total_days": <number>,
  "daily_plans": [
    {
      "day": 1,
      "topic": "<Main Topic>",
      "tasks": ["Task 1", "Task 2"],
      "estimated_hours": <number>,
      "priority": "<high|medium|low>"
    }
  ],
  "exam_readiness_tips": ["Tip 1", "Tip 2"]
}
"""

CHECKIN_SYSTEM_PROMPT = """You are SkillRoute MCQ-Gen — an AI that creates daily check-in quizzes.

## MISSION
Based on the topics studied today, generate exactly 5 Multiple Choice Questions (MCQs) to verify understanding.

## RULES
- Return ONLY raw JSON. NO markdown.
- Exactly 5 questions.
- 4 options each (A, B, C, D).
- Include explanation for the correct answer.
- Format:
{
  "questions": [
    {
      "id": 1,
      "question": "...",
      "options": {"A": "...", "B": "...", "C": "...", "D": ".."},
      "correct_answer": "A",
      "explanation": "..."
    }
  ]
}
"""

def _get_llm_client():
    if GROQ_API_KEY:
        return openai.AsyncOpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=GROQ_API_KEY,
        ), "llama-3.3-70b-versatile"
    return openai.AsyncOpenAI(
        base_url=f"{OLLAMA_API_BASE.replace('/api', '/v1')}",
        api_key="ollama-local",
    ), OLLAMA_MODEL

async def _call_llm_json(prompt: str, is_checkin: bool = False) -> str:
    client, model = _get_llm_client()
    system_prompt = CHECKIN_SYSTEM_PROMPT if is_checkin else SCHEDULE_SYSTEM_PROMPT
    try:
        resp = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=3000,
        )
        return resp.choices[0].message.content or "{}"
    except Exception as e:
        print(f"LLM Call Failed: {e}")
        return "{}"

async def generate_study_plan(
    syllabus: str, 
    days: int, 
    daily_hours: int,
    event_name: str,
    event_date: date,
    event_type: str,
    additional_notes: str
) -> dict:
    prompt = (
        f"Event Name: {event_name}\n"
        f"Event Type: {event_type}\n"
        f"Event Date: {event_date}\n"
        f"Syllabus: {syllabus}\n"
        f"Additional Notes/Requirements: {additional_notes}\n"
        f"Preparation Duration: {days} days\n"
        f"Daily Commitment: {daily_hours} hours/day"
    )
    
    result_text = await _call_llm_json(prompt, is_checkin=False)
    try:
        return json.loads(result_text)
    except json.JSONDecodeError:
        return {"title": "Failed to Parse", "total_days": days, "daily_plans": []}

async def generate_daily_mcqs(topics: str) -> dict:
    prompt = f"Topics studied today: {topics}"
    result_text = await _call_llm_json(prompt, is_checkin=True)
    try:
        data = json.loads(result_text)
        if "questions" not in data:
            return {"questions": []}
        return data
    except json.JSONDecodeError:
        return {"questions": []}

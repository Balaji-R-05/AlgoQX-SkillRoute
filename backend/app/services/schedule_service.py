import os
import json
import httpx
from typing import Optional
from datetime import date

OLLAMA_API_BASE = os.getenv("OLLAMA_API_BASE", "http://localhost:11434/api")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")

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
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{OLLAMA_API_BASE}/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": f"{SCHEDULE_SYSTEM_PROMPT}\n\nUser Input:\n{prompt}",
                "stream": False,
                "format": "json"
            }
        )
        response.raise_for_status()
        data = response.json()
        return json.loads(data["response"])

async def generate_daily_mcqs(topics: str) -> dict:
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{OLLAMA_API_BASE}/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": f"{CHECKIN_SYSTEM_PROMPT}\n\nTopics studied today: {topics}",
                "stream": False,
                "format": "json"
            }
        )
        response.raise_for_status()
        data = response.json()
        return json.loads(data["response"])

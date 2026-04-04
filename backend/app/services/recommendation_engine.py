import os
from typing import List, Dict, Any
import httpx

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Fallback recommendations if Groq fails or is not configured
FALLBACK_RECOMMENDATIONS = [
    {
        "id": "rec_rest",
        "type": "wellness",
        "message": "Your energy levels are low. Consider taking a 20-minute power nap before your next study session.",
        "priority": "high",
        "action_type": "break",
        "action_link": None
    },
    {
        "id": "rec_review",
        "type": "academic",
        "message": "You're slightly overconfident in recent topics. Spend 15 minutes reviewing your past mistakes.",
        "priority": "medium",
        "action_type": "review",
        "action_link": "/study-materials"
    }
]

async def generate_recommendations(user_data: Dict[str, Any], readiness_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Generates personalized recommendations using Groq based on readiness snapshots.
    """
    if not GROQ_API_KEY:
        return FALLBACK_RECOMMENDATIONS
        
    system_prompt = """You are an empathetic, highly analytical academic advisor AI.
Your goal is to generate 3 actionable, highly personalized recommendations for a student balancing university exams and software engineering placements.

You will receive the student's current profile, recent academic performance, and their latest 'Readiness Snapshot' (which includes stress, confidence, energy, and a composite score).

Rules for Recommendations:
1. Ensure recommendations directly address the gap between perceived readiness and actual performance (e.g., if they are 'overconfident', tell them to review past mistakes; if 'underconfident', tell them to trust their prep and do a mock test).
2. If stress is high or critical, prioritize mental health and scaling back workload (e.g., "Shift from learning new topics to revision today").
3. Keep the messages concise (max 2 sentences).
4. Return ONLY a valid JSON array of objects. No markdown formatting, no intro/outro text.

Response Schema for each object:
{
    "id": "unique_string_id",
    "type": "wellness | academic | placement | general",
    "message": "The actionable advice",
    "priority": "critical | high | medium | low",
    "action_type": "break | review | mock_interview | study",
    "action_link": "/url-string" (e.g. /mock-interview, /study-materials, /analytics, /roadmaps)
}"""

    prompt = f"""
Student Data:
Major: {user_data.get('major', 'Computer Science')}
Target Roles: {', '.join(user_data.get('targetRoles', ['Software Engineer']))}

Readiness Snapshot:
Composite Score: {readiness_data.get('composite_score', 0)}/100
Stress Level: {readiness_data.get('stress_level', 'moderate')}
Gap Label (Self vs Reality): {readiness_data.get('gap_label', 'accurate')}
Perceived Readiness: {readiness_data.get('perceived_readiness', 0)}/5
Predicted Readiness: {readiness_data.get('predicted_readiness', 0)}/5

Factors:
Quiz Average: {readiness_data.get('factors', {}).get('quiz_avg', 0)}%
Adherence Rate: {readiness_data.get('factors', {}).get('adherence_rate', 0)}%

Generate 3 recommendations in JSON format."""

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.4,
                    "max_tokens": 800,
                    "response_format": {"type": "json_object"}
                },
                timeout=15.0
            )
            
            response.raise_for_status()
            data = response.json()
            
            # The response_format: {"type": "json_object"} requires the model to output a valid JSON object.
            # Usually, we prompt it to output `{ "recommendations": [ ... ] }` to be safe when using json_object mode,
            # but let's parse the string assuming it might just be the array or an object containing the array.
            content_str = data['choices'][0]['message']['content']
            import json
            import re
            
            # Try to extract JSON if it was wrapped in markdown despite instructions
            content_str = re.sub(r"```json\s*", "", content_str)
            content_str = re.sub(r"```\s*", "", content_str)
            
            parsed = json.loads(content_str)
            
            if isinstance(parsed, list):
                return parsed
            elif isinstance(parsed, dict):
                # Look for a key that contains a list
                for val in parsed.values():
                    if isinstance(val, list):
                        return val
                return [parsed] # Fallback
            else:
                return FALLBACK_RECOMMENDATIONS
                
    except Exception as e:
        print(f"Error generating recommendations: {e}")
        # Build deterministic rules-based recommendations as fallback
        recs = []
        stress = readiness_data.get("stress_level", "moderate")
        gap = readiness_data.get("gap_label", "accurate")
        
        if stress in ["high", "critical"]:
            recs.append({
                "id": "rec_stress_fallback",
                "type": "wellness",
                "message": "Your stress levels are high. Focus only on light revision today and skip learning complex new topics.",
                "priority": "critical",
                "action_type": "break",
                "action_link": None
            })
            
        if gap == "overconfident":
            recs.append({
                "id": "rec_gap_over_fallback",
                "type": "academic",
                "message": "Your recent quiz scores are lower than your confidence level. Let's do a quick targeted review.",
                "priority": "high",
                "action_type": "review",
                "action_link": "/study-materials"
            })
        elif gap == "underconfident":
            recs.append({
                "id": "rec_gap_under_fallback",
                "type": "general",
                "message": "You're better prepared than you think! Trust your preparation and attempt a full mock test.",
                "priority": "medium",
                "action_type": "mock_interview",
                "action_link": "/mock-interview"
            })
            
        if not recs:
            return FALLBACK_RECOMMENDATIONS
            
        return recs

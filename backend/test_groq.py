import os
import asyncio
from groq import AsyncGroq
from dotenv import load_dotenv

load_dotenv(override=True)

async def test_groq():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("ERROR: GROQ_API_KEY not found in .env")
        return

    print(f"Testing Groq API Key: {api_key[:10]}...")
    client = AsyncGroq(api_key=api_key)

    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "Say hello!"}],
            max_tokens=10
        )
        print("SUCCESS: Groq API is working!")
        print(f"Response: {response.choices[0].message.content}")
    except Exception as e:
        print(f"FAILED: {type(e).__name__} - {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_groq())

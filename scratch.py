import asyncio
import sys
import os

# Set python path
sys.path.append(os.path.join(os.path.dirname(__file__), "apps", "api"))

# Load env variables into environment first, to mimic how compose runs it
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from app.core.config import get_settings
from app.services.ai_mate.gemini import stream_generate_content

async def main():
    settings = get_settings()
    print("Settings loaded successfully.")
    print("GROQ_API_KEY:", settings.groq_api_key[:10] + "..." if settings.groq_api_key else "None")
    print("GROQ_MODEL:", settings.groq_model)
    
    if not settings.groq_api_key:
        print("\nERROR: GROQ_API_KEY is empty in .env. Please fill it in and run 'make up' to test.")
        return
        
    print("\nSending stream request to Groq...")
    stream = stream_generate_content(
        settings,
        system_instruction="You are a helpful assistant.",
        user_text="hello"
    )
    
    found_any = False
    async for chunk in stream:
        found_any = True
        print(chunk, end="", flush=True)
    print()
    if not found_any:
        print("ERROR: Received empty stream!")

if __name__ == "__main__":
    asyncio.run(main())

import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


def call_gemini(prompt: str, system: str = "") -> str:
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=system if system else None,
    )
    response = model.generate_content(prompt)
    return response.text.strip()

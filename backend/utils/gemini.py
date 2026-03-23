import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


def call_gemini(prompt: str, system: str = "") -> str:
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=system if system else None,
    )
    response = model.generate_content(prompt)
    return response.text.strip()

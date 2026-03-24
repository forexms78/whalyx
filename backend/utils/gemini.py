import os
import time
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


def call_gemini(prompt: str, system: str = "", retries: int = 3) -> str:
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=system if system else None,
    )
    for attempt in range(retries):
        try:
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                wait = 30 * (attempt + 1)
                print(f"[Gemini] 요청 한도 초과, {wait}초 후 재시도 ({attempt+1}/{retries})")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError("Gemini 호출 최대 재시도 횟수 초과")

import os
import re
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

_client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY"),
    http_options=types.HttpOptions(timeout=25000),  # 25초 타임아웃
)

MOCK_MODE = os.getenv("MOCK_MODE", "false").lower() == "true"

_MOCK_RESPONSES = {
    "analyzer": """{
  "events": [
    {
      "event_type": "제재",
      "countries": ["미국", "중국"],
      "affected_sectors": ["반도체", "기술"],
      "severity": "높음",
      "summary": "미-중 반도체 수출 규제 강화로 공급망 위기 가중"
    }
  ],
  "sentiment": {
    "overall_sentiment": "부정",
    "fear_index": 65,
    "key_concern": "미-중 기술 패권 경쟁 심화"
  },
  "risk_scores": {
    "sector_risk": {
      "반도체": {"score": 8, "reason": "미-중 수출 규제 직격탄"},
      "에너지": {"score": 5, "reason": "중동 긴장 지속"},
      "금융": {"score": 4, "reason": "상대적 안전"},
      "방산": {"score": 3, "reason": "수혜 가능성"},
      "기술": {"score": 7, "reason": "공급망 리스크 노출"},
      "원자재": {"score": 5, "reason": "불확실성 유지"}
    },
    "overall_risk_level": "높음",
    "top_threat": "미-중 반도체 수출 규제"
  }
}""",
    "report": """## 요약
현재 포트폴리오는 미-중 기술 패권 경쟁으로 인해 높은 지정학적 리스크에 노출되어 있습니다.""",
}

_last_call_time: float = 0.0
_MIN_INTERVAL = 4.0
_call_count = 0


def _parse_retry_after(err_msg: str) -> float:
    match = re.search(r"retry in ([\d.]+)s", err_msg)
    return float(match.group(1)) + 2.0 if match else 30.0


def call_gemini(prompt: str, system: str = "", retries: int = 1) -> str:
    global _last_call_time, _call_count

    if MOCK_MODE:
        time.sleep(0.5)
        _call_count += 1
        if _call_count % 2 == 1:
            return _MOCK_RESPONSES["analyzer"]
        return _MOCK_RESPONSES["report"]

    config = types.GenerateContentConfig(
        system_instruction=system or None,
    )

    for attempt in range(retries):
        elapsed = time.time() - _last_call_time
        if elapsed < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - elapsed)

        try:
            _last_call_time = time.time()
            response = _client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=config,
            )
            return response.text.strip()
        except Exception as e:
            err = str(e)
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                wait = _parse_retry_after(err)
                print(f"[Gemini] 429 — {wait:.0f}초 후 재시도 ({attempt+1}/{retries})")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError("Gemini 호출 최대 재시도 횟수 초과")

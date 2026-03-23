from backend.utils.gemini import call_gemini
import json


SYSTEM = """
당신은 금융 뉴스 감정 분석 전문가입니다.
지정학 이벤트 뉴스의 시장 감정을 분석합니다.
반드시 JSON 형식으로만 응답하세요.
"""


def analyze_sentiment(classified_events: list[dict]) -> dict:
    if not classified_events:
        return {}

    events_text = "\n".join([
        f"- [{e.get('event_type')}] {e.get('summary')} (심각도: {e.get('severity')})"
        for e in classified_events
    ])

    prompt = f"""
다음 지정학 이벤트들을 분석하여 섹터별 시장 감정을 평가하세요:

{events_text}

다음 JSON 형식으로 응답하세요:
{{
  "overall_sentiment": "공포|부정|중립|긍정",
  "fear_index": 0~100,
  "sector_sentiment": {{
    "에너지": "공포|부정|중립|긍정",
    "반도체": "공포|부정|중립|긍정",
    "금융": "공포|부정|중립|긍정",
    "방산": "공포|부정|중립|긍정",
    "원자재": "공포|부정|중립|긍정"
  }},
  "key_concern": "핵심 우려사항 한 줄"
}}
"""
    try:
        raw = call_gemini(prompt, SYSTEM)
        raw = raw.strip().removeprefix("```json").removesuffix("```").strip()
        return json.loads(raw)
    except Exception:
        return {"overall_sentiment": "중립", "fear_index": 50, "sector_sentiment": {}, "key_concern": "분석 불가"}

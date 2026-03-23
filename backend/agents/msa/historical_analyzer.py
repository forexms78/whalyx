from backend.utils.gemini import call_gemini
import json


SYSTEM = """
당신은 지정학 리스크와 금융시장 역사 전문가입니다.
과거 유사 이벤트가 시장에 미친 영향을 분석합니다.
반드시 JSON 형식으로만 응답하세요.
"""


def compare_historical(classified_events: list[dict], portfolio_mapping: dict) -> dict:
    if not classified_events:
        return {}

    top_event = classified_events[0]
    sectors = list(portfolio_mapping.keys())[:3]

    prompt = f"""
현재 이벤트:
- 유형: {top_event.get("event_type")}
- 관련 국가: {top_event.get("countries")}
- 영향 섹터: {top_event.get("affected_sectors")}
- 요약: {top_event.get("summary")}

분석 대상 종목: {", ".join(sectors)}

과거 유사한 지정학 이벤트 2~3개를 찾아 시장 영향을 비교하세요:

{{
  "historical_cases": [
    {{
      "event": "이벤트명 (연도)",
      "similarity": "현재 이벤트와 유사한 이유",
      "market_impact": "당시 시장 영향",
      "recovery_period": "회복까지 걸린 기간",
      "lesson": "현재에 적용할 교훈"
    }}
  ],
  "outlook": "현재 상황 전망"
}}
"""
    try:
        raw = call_gemini(prompt, SYSTEM)
        raw = raw.strip().removeprefix("```json").removesuffix("```").strip()
        return json.loads(raw)
    except Exception:
        return {"historical_cases": [], "outlook": "분석 불가"}

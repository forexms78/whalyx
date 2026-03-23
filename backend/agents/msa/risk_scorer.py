from backend.utils.gemini import call_gemini
import json


SYSTEM = """
당신은 금융 리스크 분석 전문가입니다.
지정학 이벤트와 시장 데이터를 종합하여 섹터별 리스크 점수를 산출합니다.
반드시 JSON 형식으로만 응답하세요.
"""


def score_risks(classified_events: list[dict], sentiment: dict, financial_data: dict) -> dict:
    events_summary = "\n".join([
        f"- {e.get('event_type')}: {e.get('summary')} / 영향 섹터: {e.get('affected_sectors')} / 심각도: {e.get('severity')}"
        for e in classified_events[:5]
    ])

    fin_summary = "\n".join([
        f"- {stock}: 30일 변동 {data.get('change_30d_pct', 0)}%, 변동성 {data.get('volatility', 0)}%, 섹터: {data.get('sector', '기타')}"
        for stock, data in financial_data.items()
        if "error" not in data
    ])

    prompt = f"""
지정학 이벤트:
{events_summary}

시장 감정: {sentiment.get("overall_sentiment")} (공포지수: {sentiment.get("fear_index")})

포트폴리오 데이터:
{fin_summary}

섹터별 리스크 점수를 산출하세요 (1=안전, 10=매우위험):

{{
  "sector_risk": {{
    "반도체": {{"score": 1~10, "reason": "이유"}},
    "에너지": {{"score": 1~10, "reason": "이유"}},
    "금융": {{"score": 1~10, "reason": "이유"}},
    "방산": {{"score": 1~10, "reason": "이유"}},
    "기술": {{"score": 1~10, "reason": "이유"}},
    "원자재": {{"score": 1~10, "reason": "이유"}}
  }},
  "overall_risk_level": "매우높음|높음|중간|낮음",
  "top_threat": "가장 큰 위협 요소"
}}
"""
    try:
        raw = call_gemini(prompt, SYSTEM)
        raw = raw.strip().removeprefix("```json").removesuffix("```").strip()
        return json.loads(raw)
    except Exception:
        return {"sector_risk": {}, "overall_risk_level": "중간", "top_threat": "분석 불가"}

from datetime import datetime
from backend.graph.state import PortfolioState
from backend.utils.gemini import call_gemini

SYSTEM = """
당신은 지정학 리스크 투자 리포트 작성 전문가입니다.
분석 데이터를 바탕으로 투자자가 즉시 활용할 수 있는 한국어 리포트를 작성합니다.
"""


def report_generator(state: PortfolioState) -> dict:
    portfolio = state["portfolio"]
    analysis = state.get("analysis") or {}
    mapping = state.get("portfolio_risk_mapping") or {}
    alerts = state.get("alerts") or []

    sentiment = analysis.get("sentiment", {})
    risk_scores = analysis.get("risk_scores", {})
    events = analysis.get("events", [])

    events_text = "\n".join([
        f"- [{e.get('event_type')}|{e.get('severity')}] {e.get('summary')} (국가: {', '.join(e.get('countries', []))})"
        for e in events[:3]
    ])

    portfolio_text = "\n".join([
        f"- {stock}: 리스크 {d['risk_score']}/10 ({d['risk_level']}) | 섹터: {d['sector']} | 30일 변동: {d.get('change_30d_pct', 'N/A')}%"
        for stock, d in mapping.items()
    ])

    prompt = f"""
[분석 일시] {datetime.now().strftime("%Y년 %m월 %d일 %H:%M")}
[포트폴리오] {", ".join(portfolio)}

[주요 지정학 이벤트]
{events_text or "특이 이벤트 없음"}

[시장 감정] {sentiment.get("overall_sentiment", "중립")} / 공포지수: {sentiment.get("fear_index", 50)}/100
[핵심 우려] {sentiment.get("key_concern", "없음")}

[종목별 리스크]
{portfolio_text or "데이터 없음"}

[경보]
{chr(10).join(alerts)}

[전체 리스크 수준] {risk_scores.get("overall_risk_level", "중간")}
[주요 위협] {risk_scores.get("top_threat", "없음")}

위 데이터를 바탕으로 투자자용 지정학 리스크 리포트를 작성하세요.

형식:
## 요약
(3줄 이내)

## 주요 위협 요소
(bullet point)

## 종목별 리스크 평가
(각 종목별 1-2줄)

## 투자자 권고사항
(구체적이고 실행 가능한 조언 3가지)
"""
    report = call_gemini(prompt, SYSTEM)
    return {"final_report": report}

from backend.utils.gemini import call_gemini
from datetime import datetime


SYSTEM = """
당신은 OMS 팀의 리포트 생성 전문가입니다.
지정학 리스크 분석 결과를 투자자가 이해하기 쉬운 한국어 리포트로 작성합니다.
명확하고 실행 가능한 인사이트를 제공하세요.
"""


def generate_report(
    portfolio: list[str],
    classified_events: list[dict],
    sentiment: dict,
    risk_scores: dict,
    portfolio_mapping: dict,
    historical: dict,
    alerts: list[str],
) -> str:
    events_summary = "\n".join([
        f"- {e.get('event_type')} ({e.get('severity')}): {e.get('summary')}"
        for e in classified_events[:5]
    ])

    portfolio_summary = "\n".join([
        f"- {stock}: 리스크 {data['risk_score']}/10 ({data['risk_level']}) | 섹터: {data['sector']} | 30일 변동: {data.get('change_30d_pct', 'N/A')}%"
        for stock, data in portfolio_mapping.items()
    ])

    alerts_summary = "\n".join(alerts)

    historical_cases = "\n".join([
        f"- {c.get('event')}: {c.get('lesson')}"
        for c in historical.get("historical_cases", [])
    ])

    prompt = f"""
다음 분석 데이터를 바탕으로 투자자용 지정학 리스크 리포트를 작성하세요.

[분석 일시] {datetime.now().strftime("%Y년 %m월 %d일 %H:%M")}
[포트폴리오] {", ".join(portfolio)}

[주요 지정학 이벤트]
{events_summary}

[시장 감정] {sentiment.get("overall_sentiment")} / 공포지수: {sentiment.get("fear_index")}/100
[핵심 우려] {sentiment.get("key_concern")}

[종목별 리스크]
{portfolio_summary}

[알림]
{alerts_summary}

[과거 유사 사례]
{historical_cases}

[전망] {historical.get("outlook", "")}

리포트 형식:
1. 요약 (3줄)
2. 주요 위협 요소
3. 종목별 리스크 평가
4. 과거 사례와 비교
5. 투자자 권고사항
"""
    return call_gemini(prompt, SYSTEM)

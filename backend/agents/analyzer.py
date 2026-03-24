import json
from backend.graph.state import PortfolioState
from backend.utils.gemini import call_gemini

SYSTEM = """
당신은 지정학 리스크 투자 분석 전문가입니다.
뉴스와 금융 데이터를 종합하여 이벤트 분류, 시장 감정, 섹터별 리스크를 한 번에 분석합니다.
반드시 JSON 형식으로만 응답하세요.
"""


def _score_to_level(score: int) -> str:
    if score >= 8:
        return "매우높음"
    elif score >= 6:
        return "높음"
    elif score >= 4:
        return "중간"
    else:
        return "낮음"


def _build_portfolio_mapping(portfolio: list, financial_data: dict, risk_scores: dict) -> dict:
    sector_risk = risk_scores.get("sector_risk", {})
    result = {}
    for stock in portfolio:
        data = financial_data.get(stock, {})
        sector = data.get("sector", "기타")
        sector_info = sector_risk.get(sector, {})
        score = sector_info.get("score", 5)

        volatility = data.get("volatility", 0)
        if volatility and volatility > 3:
            score = min(10, score + 1)

        change = data.get("change_30d_pct", 0)
        if change and change < -10:
            score = min(10, score + 1)

        result[stock] = {
            "sector": sector,
            "risk_score": score,
            "risk_level": _score_to_level(score),
            "sector_reason": sector_info.get("reason", ""),
            "current_price": data.get("current_price"),
            "change_30d_pct": data.get("change_30d_pct"),
            "volatility": data.get("volatility"),
        }
    return dict(sorted(result.items(), key=lambda x: x[1]["risk_score"], reverse=True))


def _build_alerts(portfolio_mapping: dict, risk_scores: dict) -> list:
    alerts = []
    overall = risk_scores.get("overall_risk_level", "중간")
    top_threat = risk_scores.get("top_threat", "")

    if overall in ["높음", "매우높음"]:
        alerts.append(f"[전체 경보] 포트폴리오 리스크 수준: {overall} — {top_threat}")

    for stock, data in portfolio_mapping.items():
        score = data.get("risk_score", 0)
        change = data.get("change_30d_pct", 0)
        if score >= 7:
            alerts.append(f"[위험 종목] {stock} — 리스크 {score}/10 ({data.get('risk_level')}) | {data.get('sector_reason', '')}")
        if change and change < -10:
            alerts.append(f"[급락 경보] {stock} 최근 30일 {change:.1f}% 하락")

    if not alerts:
        alerts.append("[안전] 현재 포트폴리오 리스크 수준 양호")
    return alerts


def _build_visualization(portfolio_mapping: dict, analysis: dict) -> dict:
    risk_scores = analysis.get("risk_scores", {})
    sector_risk = risk_scores.get("sector_risk", {})
    return {
        "portfolio_risk": {
            stock: data["risk_score"]
            for stock, data in portfolio_mapping.items()
        },
        "sector_risk": {
            sector: info.get("score", 5)
            for sector, info in sector_risk.items()
        },
        "fear_index": analysis.get("sentiment", {}).get("fear_index", 50),
        "overall_risk_level": risk_scores.get("overall_risk_level", "중간"),
    }


def analyzer(state: PortfolioState) -> dict:
    news = state.get("raw_news") or []
    financial = state.get("financial_data") or {}
    portfolio = state["portfolio"]

    news_text = "\n".join([
        f"- {n['title']}: {n.get('description', '')[:150]}"
        for n in news[:5]
        if "error" not in n
    ])

    fin_text = "\n".join([
        f"- {stock}: 30일 변동 {d.get('change_30d_pct', 0)}%, 변동성 {d.get('volatility', 0)}%, 섹터: {d.get('sector', '기타')}"
        for stock, d in financial.items()
        if "error" not in d
    ])

    prompt = f"""
포트폴리오: {", ".join(portfolio)}

[최근 지정학 뉴스]
{news_text or "뉴스 없음"}

[포트폴리오 금융 데이터]
{fin_text or "데이터 없음"}

위 데이터를 분석하여 다음 JSON 형식으로 응답하세요:
{{
  "events": [
    {{
      "event_type": "전쟁|제재|분쟁|외교|기타",
      "countries": ["국가1"],
      "affected_sectors": ["반도체|에너지|금융|방산|원자재|기술|기타"],
      "severity": "높음|중간|낮음",
      "summary": "한 줄 요약"
    }}
  ],
  "sentiment": {{
    "overall_sentiment": "공포|부정|중립|긍정",
    "fear_index": 0,
    "key_concern": "핵심 우려사항"
  }},
  "risk_scores": {{
    "sector_risk": {{
      "반도체": {{"score": 5, "reason": "이유"}},
      "에너지": {{"score": 5, "reason": "이유"}},
      "금융": {{"score": 5, "reason": "이유"}},
      "방산": {{"score": 5, "reason": "이유"}},
      "기술": {{"score": 5, "reason": "이유"}},
      "원자재": {{"score": 5, "reason": "이유"}}
    }},
    "overall_risk_level": "매우높음|높음|중간|낮음",
    "top_threat": "가장 큰 위협"
  }}
}}
"""
    try:
        raw = call_gemini(prompt, SYSTEM)
        raw = raw.strip().removeprefix("```json").removesuffix("```").strip()
        analysis = json.loads(raw)
    except Exception:
        analysis = {
            "events": [],
            "sentiment": {"overall_sentiment": "중립", "fear_index": 50, "key_concern": "분석 불가"},
            "risk_scores": {"sector_risk": {}, "overall_risk_level": "중간", "top_threat": "분석 불가"},
        }

    portfolio_mapping = _build_portfolio_mapping(portfolio, financial, analysis.get("risk_scores", {}))
    alerts = _build_alerts(portfolio_mapping, analysis.get("risk_scores", {}))
    visualization_data = _build_visualization(portfolio_mapping, analysis)

    return {
        "analysis": analysis,
        "portfolio_risk_mapping": portfolio_mapping,
        "alerts": alerts,
        "visualization_data": visualization_data,
    }

def build_visualization_data(
    portfolio_mapping: dict,
    risk_scores: dict,
    sentiment: dict,
    classified_events: list[dict],
) -> dict:
    # 종목별 리스크 차트 데이터
    portfolio_chart = [
        {
            "stock": stock,
            "risk_score": data["risk_score"],
            "risk_level": data["risk_level"],
            "sector": data["sector"],
            "change_30d": data.get("change_30d_pct", 0),
        }
        for stock, data in portfolio_mapping.items()
    ]

    # 섹터별 리스크 차트 데이터
    sector_risk = risk_scores.get("sector_risk", {})
    sector_chart = [
        {"sector": sector, "score": info.get("score", 5)}
        for sector, info in sector_risk.items()
    ]

    # 이벤트 타임라인 데이터
    event_timeline = [
        {
            "date": e.get("published_at", "")[:10],
            "type": e.get("event_type"),
            "severity": e.get("severity"),
            "summary": e.get("summary"),
        }
        for e in classified_events[:10]
    ]

    return {
        "portfolio_risk_chart": portfolio_chart,
        "sector_risk_chart": sector_chart,
        "event_timeline": event_timeline,
        "fear_index": sentiment.get("fear_index", 50),
        "overall_sentiment": sentiment.get("overall_sentiment", "중립"),
        "overall_risk_level": risk_scores.get("overall_risk_level", "중간"),
    }

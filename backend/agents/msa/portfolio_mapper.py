def map_portfolio_risk(portfolio: list[str], financial_data: dict, risk_scores: dict) -> dict:
    sector_risk = risk_scores.get("sector_risk", {})
    result = {}

    for stock in portfolio:
        data = financial_data.get(stock, {})
        sector = data.get("sector", "기타")
        sector_info = sector_risk.get(sector, {})
        risk_score = sector_info.get("score", 5)

        # 변동성 가중치 반영
        volatility = data.get("volatility", 0)
        if volatility > 3:
            risk_score = min(10, risk_score + 1)

        # 30일 하락 반영
        change = data.get("change_30d_pct", 0)
        if change < -10:
            risk_score = min(10, risk_score + 1)

        result[stock] = {
            "sector": sector,
            "risk_score": risk_score,
            "risk_level": _score_to_level(risk_score),
            "sector_reason": sector_info.get("reason", ""),
            "current_price": data.get("current_price"),
            "change_30d_pct": data.get("change_30d_pct"),
            "volatility": data.get("volatility"),
        }

    return dict(sorted(result.items(), key=lambda x: x[1]["risk_score"], reverse=True))


def _score_to_level(score: int) -> str:
    if score >= 8:
        return "매우높음"
    elif score >= 6:
        return "높음"
    elif score >= 4:
        return "중간"
    else:
        return "낮음"

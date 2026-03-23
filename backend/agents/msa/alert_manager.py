RISK_THRESHOLD = 7  # 리스크 점수 7 이상이면 알림


def generate_alerts(portfolio_mapping: dict, risk_scores: dict) -> list[str]:
    alerts = []
    overall = risk_scores.get("overall_risk_level", "중간")
    top_threat = risk_scores.get("top_threat", "")

    if overall in ["높음", "매우높음"]:
        alerts.append(f"[전체 경보] 포트폴리오 전반적 리스크 수준: {overall} — {top_threat}")

    for stock, data in portfolio_mapping.items():
        score = data.get("risk_score", 0)
        level = data.get("risk_level", "")
        reason = data.get("sector_reason", "")
        change = data.get("change_30d_pct", 0)

        if score >= RISK_THRESHOLD:
            alerts.append(
                f"[위험 종목] {stock} — 리스크 {score}/10 ({level}) | {reason}"
            )

        if change is not None and change < -10:
            alerts.append(
                f"[급락 경보] {stock} 최근 30일 {change:.1f}% 하락"
            )

    if not alerts:
        alerts.append("[안전] 현재 포트폴리오 리스크 수준 양호")

    return alerts

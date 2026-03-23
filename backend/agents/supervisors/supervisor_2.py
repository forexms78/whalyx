"""
Supervisor 2 — 분석 파이프라인
담당 MSA: RiskScorer, PortfolioMapper, HistoricalAnalyzer, AlertManager
"""
from backend.graph.state import PortfolioState
from backend.agents.msa.risk_scorer import score_risks
from backend.agents.msa.portfolio_mapper import map_portfolio_risk
from backend.agents.msa.historical_analyzer import compare_historical
from backend.agents.msa.alert_manager import generate_alerts


def supervisor_2(state: PortfolioState) -> dict:
    classified_events = state.get("classified_events", [])
    sentiment_scores = state.get("sentiment_scores", {})
    financial_data = state.get("financial_data", {})
    portfolio = state["portfolio"]

    print("[Supervisor 2] 리스크 스코어링 중...")
    risk_scores = score_risks(classified_events, sentiment_scores, financial_data)

    print("[Supervisor 2] 포트폴리오 매핑 중...")
    portfolio_risk_mapping = map_portfolio_risk(portfolio, financial_data, risk_scores)

    print("[Supervisor 2] 과거 사례 분석 중...")
    historical_comparison = compare_historical(classified_events, portfolio_risk_mapping)

    print("[Supervisor 2] 알림 생성 중...")
    alerts = generate_alerts(portfolio_risk_mapping, risk_scores)

    print("[Supervisor 2] 분석 파이프라인 완료")
    return {
        "risk_scores": risk_scores,
        "portfolio_risk_mapping": portfolio_risk_mapping,
        "historical_comparison": historical_comparison,
        "alerts": alerts,
    }

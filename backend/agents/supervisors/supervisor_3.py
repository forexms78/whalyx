"""
Supervisor 3 — 아웃풋 파이프라인
담당 MSA: ReportGenerator, Visualizer, DataStorage
"""
from backend.graph.state import PortfolioState
from backend.agents.msa.report_generator import generate_report
from backend.agents.msa.visualizer import build_visualization_data
from backend.agents.msa.data_storage import store_analysis


def supervisor_3(state: PortfolioState) -> dict:
    portfolio = state["portfolio"]
    classified_events = state.get("classified_events", [])
    sentiment_scores = state.get("sentiment_scores", {})
    risk_scores = state.get("risk_scores", {})
    portfolio_risk_mapping = state.get("portfolio_risk_mapping", {})
    historical_comparison = state.get("historical_comparison", {})
    alerts = state.get("alerts", [])

    print("[Supervisor 3] 리포트 생성 중...")
    report = generate_report(
        portfolio=portfolio,
        classified_events=classified_events,
        sentiment=sentiment_scores,
        risk_scores=risk_scores,
        portfolio_mapping=portfolio_risk_mapping,
        historical=historical_comparison,
        alerts=alerts,
    )

    print("[Supervisor 3] 시각화 데이터 구성 중...")
    visualization_data = build_visualization_data(
        portfolio_mapping=portfolio_risk_mapping,
        risk_scores=risk_scores,
        sentiment=sentiment_scores,
        classified_events=classified_events,
    )

    print("[Supervisor 3] 데이터 저장 중...")
    stored = store_analysis(portfolio, report, visualization_data, risk_scores)

    print("[Supervisor 3] 아웃풋 파이프라인 완료")
    return {
        "report": report,
        "visualization_data": visualization_data,
        "stored": stored,
    }

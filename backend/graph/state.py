from typing import TypedDict, List, Optional


class PortfolioState(TypedDict):
    # 사용자 입력
    user_request: str
    portfolio: List[str]

    # PM Agent
    pm_task: Optional[str]
    pm_approved: Optional[bool]
    pm_feedback: Optional[str]

    # TPM Agent
    tpm_plan: Optional[str]
    tpm_execution_order: Optional[List[str]]

    # Supervisor 1 — 데이터 파이프라인
    raw_news: Optional[List[dict]]
    classified_events: Optional[List[dict]]
    sentiment_scores: Optional[dict]
    financial_data: Optional[dict]

    # Supervisor 2 — 분석 파이프라인
    risk_scores: Optional[dict]
    portfolio_risk_mapping: Optional[dict]
    historical_comparison: Optional[dict]
    alerts: Optional[List[str]]

    # Supervisor 3 — 아웃풋 파이프라인
    report: Optional[str]
    visualization_data: Optional[dict]
    stored: Optional[bool]

    # 최종 결과
    final_report: Optional[str]
    error: Optional[str]

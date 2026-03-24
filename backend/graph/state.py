from typing import TypedDict, List, Optional


class PortfolioState(TypedDict):
    # 입력
    user_request: str
    portfolio: List[str]

    # 데이터 수집 (no LLM)
    raw_news: Optional[List[dict]]
    financial_data: Optional[dict]

    # 분석 결과 (LLM 1회)
    analysis: Optional[dict]          # events, sentiment, risk_scores
    portfolio_risk_mapping: Optional[dict]
    alerts: Optional[List[str]]
    visualization_data: Optional[dict]

    # 최종 리포트 (LLM 1회)
    final_report: Optional[str]
    error: Optional[str]

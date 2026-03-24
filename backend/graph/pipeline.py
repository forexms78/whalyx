from langgraph.graph import StateGraph, END
from backend.graph.state import PortfolioState
from backend.agents.data_collector import data_collector
from backend.agents.analyzer import analyzer
from backend.agents.report_generator import report_generator


def build_pipeline() -> StateGraph:
    graph = StateGraph(PortfolioState)

    graph.add_node("data_collector", data_collector)
    graph.add_node("analyzer", analyzer)
    graph.add_node("report_generator", report_generator)

    graph.set_entry_point("data_collector")
    graph.add_edge("data_collector", "analyzer")
    graph.add_edge("analyzer", "report_generator")
    graph.add_edge("report_generator", END)

    return graph.compile()


pipeline = build_pipeline()


def run_analysis(user_request: str, portfolio: list[str]) -> dict:
    initial_state: PortfolioState = {
        "user_request": user_request,
        "portfolio": portfolio,
        "raw_news": None,
        "financial_data": None,
        "analysis": None,
        "portfolio_risk_mapping": None,
        "alerts": None,
        "visualization_data": None,
        "final_report": None,
        "error": None,
    }
    return pipeline.invoke(initial_state)

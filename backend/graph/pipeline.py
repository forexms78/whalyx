from langgraph.graph import StateGraph, END
from backend.graph.state import PortfolioState
from backend.agents.pm_agent import pm_agent, pm_qa
from backend.agents.tpm_agent import tpm_agent
from backend.agents.supervisors.supervisor_1 import supervisor_1
from backend.agents.supervisors.supervisor_2 import supervisor_2
from backend.agents.supervisors.supervisor_3 import supervisor_3


def should_revise(state: PortfolioState) -> str:
    if state.get("pm_approved"):
        return "approved"
    return "end"  # 재작업 루프 방지 (MVP에서는 1회만)


def build_pipeline() -> StateGraph:
    graph = StateGraph(PortfolioState)

    # 노드 등록
    graph.add_node("pm", pm_agent)
    graph.add_node("tpm", tpm_agent)
    graph.add_node("supervisor_1", supervisor_1)
    graph.add_node("supervisor_2", supervisor_2)
    graph.add_node("supervisor_3", supervisor_3)
    graph.add_node("pm_qa", pm_qa)

    # 엣지 연결
    graph.set_entry_point("pm")
    graph.add_edge("pm", "tpm")
    graph.add_edge("tpm", "supervisor_1")
    graph.add_edge("supervisor_1", "supervisor_2")
    graph.add_edge("supervisor_2", "supervisor_3")
    graph.add_edge("supervisor_3", "pm_qa")
    graph.add_conditional_edges(
        "pm_qa",
        should_revise,
        {"approved": END, "end": END},
    )

    return graph.compile()


pipeline = build_pipeline()


def run_analysis(user_request: str, portfolio: list[str]) -> dict:
    initial_state: PortfolioState = {
        "user_request": user_request,
        "portfolio": portfolio,
        "pm_task": None,
        "pm_approved": None,
        "pm_feedback": None,
        "tpm_plan": None,
        "tpm_execution_order": None,
        "raw_news": None,
        "classified_events": None,
        "sentiment_scores": None,
        "financial_data": None,
        "risk_scores": None,
        "portfolio_risk_mapping": None,
        "historical_comparison": None,
        "alerts": None,
        "report": None,
        "visualization_data": None,
        "stored": None,
        "final_report": None,
        "error": None,
    }

    result = pipeline.invoke(initial_state)
    return result

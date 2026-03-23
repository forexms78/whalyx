from backend.graph.state import PortfolioState
from backend.utils.gemini import call_gemini


SYSTEM = """
당신은 OMS 팀의 PM입니다.
사용자의 포트폴리오 리스크 분석 요청을 파악하고, TPM에게 전달할 태스크를 명확하게 정의합니다.
최종 리포트가 돌아오면 품질을 검토하고 승인 또는 재작업 지시를 내립니다.
"""


def pm_agent(state: PortfolioState) -> dict:
    portfolio_str = ", ".join(state["portfolio"])

    prompt = f"""
사용자 요청: {state["user_request"]}
분석 대상 포트폴리오: {portfolio_str}

TPM에게 전달할 태스크를 한국어로 명확하게 정의해주세요.
포함 내용: 분석 범위, 뉴스 기간, 리스크 기준, 기대 산출물
"""
    task = call_gemini(prompt, SYSTEM)
    return {"pm_task": task}


def pm_qa(state: PortfolioState) -> dict:
    prompt = f"""
다음 리포트를 검토하고 승인 여부를 결정하세요.

리포트:
{state.get("report", "")}

포트폴리오: {", ".join(state["portfolio"])}

검토 기준:
1. 모든 종목에 대한 리스크 분석이 포함되었는가?
2. 지정학 이벤트와 종목 연관성이 명확한가?
3. 실행 가능한 인사이트가 있는가?

승인이면 "APPROVED", 재작업이면 "REVISION: [사유]"로 답하세요.
"""
    result = call_gemini(prompt, SYSTEM)
    approved = result.startswith("APPROVED")
    return {
        "pm_approved": approved,
        "pm_feedback": result,
        "final_report": state.get("report") if approved else None,
    }

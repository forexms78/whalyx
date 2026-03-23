from backend.graph.state import PortfolioState
from backend.utils.gemini import call_gemini


SYSTEM = """
당신은 OMS 팀의 TPM(Technical Project Manager) AI입니다.
PM이 정의한 태스크를 받아 기술적 실행 계획을 수립하고,
어떤 에이전트를 어떤 순서로 실행할지 결정합니다.
"""


def tpm_agent(state: PortfolioState) -> dict:
    prompt = f"""
PM 태스크: {state["pm_task"]}
포트폴리오: {", ".join(state["portfolio"])}

기술 실행 계획을 수립하세요:
1. 데이터 수집 단계 (뉴스, 금융 데이터)
2. 분석 단계 (리스크 스코어링, 포트폴리오 매핑)
3. 아웃풋 단계 (리포트, 시각화)

각 단계별 에이전트 실행 순서와 주의사항을 포함하세요.
"""
    plan = call_gemini(prompt, SYSTEM)
    execution_order = ["supervisor_1", "supervisor_2", "supervisor_3"]
    return {"tpm_plan": plan, "tpm_execution_order": execution_order}

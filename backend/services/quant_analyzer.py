import json
import math
from backend.utils.gemini import call_gemini

SYSTEM = """
당신은 금융 텍스트 파서입니다. 입력된 텍스트에서 주식 분석 데이터를 추출해 JSON으로만 응답하세요.
마크다운 코드블록 없이 순수 JSON만 반환하세요.

추출 필드:
- ticker: 종목코드 (AAPL, 005930 등)
- market: US 또는 KR
- name: 종목명
- current_price: 현재 주가 (숫자)
- forward_eps: 선행 EPS (숫자)
- bps: 주당순자산 BPS (숫자, 없으면 null)
- eps_growth_rate: EPS 성장률 % (숫자, 없으면 null)
- overhang_note: 오버행 등 리스크 메모 (문자열, 없으면 null)

찾을 수 없는 필드는 null로 반환하세요.
"""


def parse_analysis_text(text: str) -> dict:
    prompt = f"다음 텍스트에서 주식 데이터를 추출하세요:\n\n{text}"
    raw = call_gemini(prompt, SYSTEM)
    try:
        return json.loads(raw.strip())
    except Exception:
        return {}


def calculate_metrics(
    current_price: float,
    forward_eps: float,
    bps: float | None,
    eps_growth_rate: float | None,
    target_pe: float,
) -> dict:
    if not current_price or not forward_eps or forward_eps == 0:
        return {}

    forward_pe = round(current_price / forward_eps, 2)
    fair_value_pe = round(target_pe * forward_eps, 2)

    fair_value_graham = None
    if bps and bps > 0 and forward_eps > 0:
        fair_value_graham = round(math.sqrt(22.5 * forward_eps * bps), 2)

    fair_value_peg = None
    if eps_growth_rate and eps_growth_rate > 0:
        fair_value_peg = round(eps_growth_rate * forward_eps, 2)

    values = [v for v in [fair_value_pe, fair_value_graham, fair_value_peg] if v]
    avg_fair_value = round(sum(values) / len(values), 2) if values else None

    return {
        "forward_pe": forward_pe,
        "fair_value_pe": fair_value_pe,
        "fair_value_graham": fair_value_graham,
        "fair_value_peg": fair_value_peg,
        "avg_fair_value": avg_fair_value,
    }


def calculate_signal(metrics: dict, current_price: float) -> str:
    avg = metrics.get("avg_fair_value")
    if avg and current_price > avg * 1.2:
        return "sell"
    if avg and current_price < avg:
        return "buy"
    return "hold"


def analyze(text: str, target_pe: float = 30) -> dict:
    parsed = parse_analysis_text(text)
    if not parsed.get("current_price") or not parsed.get("forward_eps"):
        return {"error": "현재가 또는 EPS를 텍스트에서 찾을 수 없습니다."}

    metrics = calculate_metrics(
        current_price=parsed["current_price"],
        forward_eps=parsed["forward_eps"],
        bps=parsed.get("bps"),
        eps_growth_rate=parsed.get("eps_growth_rate"),
        target_pe=target_pe,
    )
    signal = calculate_signal(metrics, parsed["current_price"])

    return {**parsed, **metrics, "signal": signal, "target_pe": target_pe}

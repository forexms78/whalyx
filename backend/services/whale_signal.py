import time
import json
from datetime import datetime
from typing import Optional
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))

_signal_cache: Optional[tuple[dict, float]] = None
SIGNAL_TTL = 1800


def _score_to_label(score: int) -> tuple[str, str]:
    """점수를 라벨과 색상으로 변환"""
    if score >= 75:
        return "Strong Buy", "#10b981"
    elif score >= 55:
        return "Buy", "#34d399"
    elif score >= 40:
        return "Neutral", "#E8A855"
    else:
        return "Avoid", "#ef4444"


async def get_whale_signal(money_flow_assets: list[dict], fed_rate: float) -> dict:
    global _signal_cache
    now = time.time()
    if _signal_cache and now - _signal_cache[1] < SIGNAL_TTL:
        return _signal_cache[0]

    # money_flow_assets에서 각 자산군 수익률 추출
    spy_chg = next((a["change_30d"] for a in money_flow_assets if "SPY" in a.get("name", "") or a.get("category") == "주식"), 0) or 0
    tlt_chg = next((a["change_30d"] for a in money_flow_assets if "TLT" in a.get("name", "") or a.get("category") == "채권"), 0) or 0
    gld_chg = next((a["change_30d"] for a in money_flow_assets if "GLD" in a.get("name", "") or "금" in a.get("name", "")), 0) or 0
    btc_chg = next((a["change_30d"] for a in money_flow_assets if "BTC" in a.get("name", "") or a.get("category") == "코인"), 0) or 0
    re_chg = next((a["change_30d"] for a in money_flow_assets if a.get("category") == "부동산" or "REITs" in a.get("name", "")), 0) or 0

    # 금리 레벨 기반 기본 스코어 조정
    rate_penalty_bonds = max(0, (fed_rate - 3) * 5)   # 고금리 → 채권 불리
    rate_bonus_savings = min(20, fed_rate * 3)          # 고금리 → 현금 유리 (참고용)

    # 각 자산군 스코어 계산 (수익률 + 금리 환경)
    stock_score    = min(100, max(0, 50 + spy_chg * 2 - (fed_rate - 4) * 3))
    bond_score     = min(100, max(0, 50 + tlt_chg * 3 - rate_penalty_bonds))
    gold_score     = min(100, max(0, 50 + gld_chg * 2 + (fed_rate - 3) * 2))
    crypto_score   = min(100, max(0, 50 + btc_chg * 1.5 - (fed_rate - 3) * 4))
    realestate_score = min(100, max(0, 45 + re_chg * 2 - (fed_rate - 3) * 5))

    scores = {
        "주식":   int(stock_score),
        "코인":   int(crypto_score),
        "금/광물": int(gold_score),
        "채권":   int(bond_score),
        "부동산": int(realestate_score),
    }

    picks_map = {
        "주식":   ["SPY (S&P500 ETF)", "QQQ (나스닥 ETF)", "NVDA", "META"],
        "코인":   ["BTC", "ETH", "SOL"],
        "금/광물": ["GLD (금 ETF)", "SLV (은 ETF)", "CPER (구리 ETF)"],
        "채권":   ["IEF (중기국채 ETF)", "TLT (장기국채 ETF)"],
        "부동산": ["VNQ (리츠 ETF)", "IYR (부동산 ETF)"],
    }

    signals = []
    for asset, score in sorted(scores.items(), key=lambda x: -x[1]):
        label, color = _score_to_label(score)
        signals.append({
            "asset":  asset,
            "label":  label,
            "score":  score,
            "color":  color,
            "picks":  picks_map.get(asset, []),
        })

    # 1위 자산군 헤드라인
    top_asset = signals[0]["asset"]
    top_label = signals[0]["label"]

    # Gemini AI 인사이트
    ai_insight = ""
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = f"""당신은 글로벌 거시경제 투자 전략가입니다.

현재 시장 데이터:
- Fed 기준금리: {fed_rate}%
- 주식(SPY) 30일 수익률: {spy_chg:.1f}%
- 채권(TLT) 30일 수익률: {tlt_chg:.1f}%
- 금(GLD) 30일 수익률: {gld_chg:.1f}%
- 비트코인 30일 수익률: {btc_chg:.1f}%

자산군별 투자 점수:
{json.dumps(scores, ensure_ascii=False)}

위 데이터를 기반으로 "거대한 돈이 지금 어디로 이동하는가"를 3-4문장으로 분석해주세요.
- 현재 금리 환경이 각 자산군에 미치는 영향
- 가장 유망한 자산군과 그 이유
- 구체적인 투자 행동 조언
한국어로 작성. 숫자와 근거를 포함할 것."""
        response = model.generate_content(prompt)
        ai_insight = response.text
    except Exception:
        ai_insight = f"현재 Fed 금리 {fed_rate}% 환경에서 {top_asset}이(가) 가장 유망한 투자처로 분석됩니다."

    result = {
        "headline": f"지금은 {top_asset}에 집중하세요" if top_label in ["Strong Buy", "Buy"] else "시장 변동성 높음 — 분산 투자 권장",
        "signals":    signals,
        "ai_insight": ai_insight,
        "fed_rate":   fed_rate,
        "updated_at": datetime.now().isoformat(),
    }

    _signal_cache = (result, time.time())
    return result

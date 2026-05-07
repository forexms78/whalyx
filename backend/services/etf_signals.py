"""미장 ETF + 미장 대형주 + 한국 주식 매수/매도 시그널

파이프라인:
  Yahoo Finance v8 chart REST 1y 종가 (한국 IP 우회)
    → RSI(14), 52주 위치, 50/200 MA, 1m/3m/1y 수익률 계산
    → Gemini 2.5 Flash 배치 1회 호출 (34종 일괄 판정)
    → STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL + 한 줄 근거
    → 시그널 우선순위 정렬 → 그룹별 분류
"""
import json
import re
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from backend.utils.gemini import call_gemini

_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
})

# ─────────────────────────────────────────────
# 종목 정의
# ─────────────────────────────────────────────

ETF_LIST = [
    {"ticker": "QQQ",  "name": "Invesco QQQ Trust",            "category": "나스닥 100"},
    {"ticker": "SPY",  "name": "SPDR S&P 500 ETF",             "category": "S&P 500"},
    {"ticker": "VOO",  "name": "Vanguard S&P 500 ETF",         "category": "S&P 500 저비용"},
    {"ticker": "VTI",  "name": "Vanguard Total Stock Market",  "category": "미국 전체"},
    {"ticker": "DIA",  "name": "SPDR Dow Jones Industrial",    "category": "다우 30"},
    {"ticker": "IWM",  "name": "iShares Russell 2000",         "category": "소형주"},
    {"ticker": "SOXX", "name": "iShares Semiconductor ETF",    "category": "반도체"},
    {"ticker": "XLK",  "name": "Technology Select Sector SPDR","category": "테크 섹터"},
    {"ticker": "ARKK", "name": "ARK Innovation ETF",           "category": "혁신주"},
    {"ticker": "GLD",  "name": "SPDR Gold Shares",             "category": "금"},
]

US_STOCK_LIST = [
    {"ticker": "AAPL",  "name": "Apple Inc.",            "category": "테크"},
    {"ticker": "MSFT",  "name": "Microsoft Corp.",       "category": "테크"},
    {"ticker": "NVDA",  "name": "NVIDIA Corp.",          "category": "반도체"},
    {"ticker": "GOOGL", "name": "Alphabet Inc.",         "category": "테크"},
    {"ticker": "AMZN",  "name": "Amazon.com Inc.",       "category": "이커머스"},
    {"ticker": "META",  "name": "Meta Platforms",        "category": "테크"},
    {"ticker": "TSLA",  "name": "Tesla Inc.",            "category": "전기차"},
    {"ticker": "AVGO",  "name": "Broadcom Inc.",         "category": "반도체"},
    {"ticker": "JPM",   "name": "JPMorgan Chase",        "category": "금융"},
    {"ticker": "NFLX",  "name": "Netflix Inc.",          "category": "미디어"},
    {"ticker": "AMD",   "name": "Advanced Micro Devices","category": "반도체"},
    {"ticker": "COST",  "name": "Costco Wholesale",      "category": "소비재"},
]

KR_STOCK_LIST = [
    {"ticker": "005930.KS", "name": "삼성전자",             "category": "반도체"},
    {"ticker": "000660.KS", "name": "SK하이닉스",           "category": "반도체"},
    {"ticker": "373220.KS", "name": "LG에너지솔루션",       "category": "배터리"},
    {"ticker": "207940.KS", "name": "삼성바이오로직스",     "category": "바이오"},
    {"ticker": "005380.KS", "name": "현대차",               "category": "자동차"},
    {"ticker": "000270.KS", "name": "기아",                 "category": "자동차"},
    {"ticker": "035420.KS", "name": "NAVER",                "category": "인터넷"},
    {"ticker": "035720.KS", "name": "카카오",               "category": "인터넷"},
    {"ticker": "068270.KS", "name": "셀트리온",             "category": "바이오"},
    {"ticker": "005490.KS", "name": "POSCO홀딩스",          "category": "철강"},
    {"ticker": "012450.KS", "name": "한화에어로스페이스",   "category": "방산"},
    {"ticker": "034020.KS", "name": "두산에너빌리티",       "category": "발전"},
]

ALL_ITEMS = ETF_LIST + US_STOCK_LIST + KR_STOCK_LIST

SIGNAL_ORDER = {"STRONG_BUY": 0, "BUY": 1, "HOLD": 2, "SELL": 3, "STRONG_SELL": 4}


# ─────────────────────────────────────────────
# Yahoo Finance REST 1년 종가
# ─────────────────────────────────────────────

def _fetch_history(ticker: str) -> dict | None:
    try:
        url = (
            f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}"
            f"?interval=1d&range=1y"
        )
        r = _session.get(url, timeout=10)
        r.raise_for_status()
        result = r.json()["chart"]["result"][0]
        meta = result.get("meta", {})
        closes = [c for c in result["indicators"]["quote"][0]["close"] if c is not None]
        if len(closes) < 50:
            return None
        return {
            "closes":      closes,
            "currency":    meta.get("currency", "USD"),
            "week52_high": meta.get("fiftyTwoWeekHigh"),
            "week52_low":  meta.get("fiftyTwoWeekLow"),
        }
    except Exception:
        return None


# ─────────────────────────────────────────────
# 기술 지표 계산
# ─────────────────────────────────────────────

def _calc_rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    deltas = [closes[i + 1] - closes[i] for i in range(len(closes) - 1)]
    gains  = [d if d > 0 else 0 for d in deltas]
    losses = [-d if d < 0 else 0 for d in deltas]
    avg_gain = sum(gains[-period:])  / period
    avg_loss = sum(losses[-period:]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 1)


def _calc_metrics(item: dict, hist: dict) -> dict:
    closes  = hist["closes"]
    current = closes[-1]

    rsi = _calc_rsi(closes, 14)

    week52_high = hist.get("week52_high") or max(closes)
    week52_low  = hist.get("week52_low")  or min(closes)
    if week52_high > week52_low:
        week52_pos = round((current - week52_low) / (week52_high - week52_low) * 100, 1)
    else:
        week52_pos = 50.0

    ma50  = round(sum(closes[-50:]) / 50, 2)
    ma200 = (
        round(sum(closes[-200:]) / 200, 2)
        if len(closes) >= 200
        else round(sum(closes) / len(closes), 2)
    )

    def chg(periods):
        if len(closes) <= periods:
            return None
        return round((current - closes[-periods - 1]) / closes[-periods - 1] * 100, 1)

    return {
        "ticker":         item["ticker"],
        "name":           item["name"],
        "category":       item["category"],
        "currency":       hist["currency"],
        "current_price":  round(current, 2),
        "rsi":            rsi,
        "week52_high":    round(week52_high, 2),
        "week52_low":     round(week52_low, 2),
        "week52_pos":     week52_pos,
        "ma50":           ma50,
        "ma200":          ma200,
        "above_ma50":     current > ma50,
        "above_ma200":    current > ma200,
        "golden_cross":   ma50 > ma200,
        "change_1m":      chg(21),
        "change_3m":      chg(63),
        "change_1y":      round((current - closes[0]) / closes[0] * 100, 1),
    }


# ─────────────────────────────────────────────
# Gemini 배치 판정
# ─────────────────────────────────────────────

SYSTEM = """당신은 월스트리트 시장 기술분석가입니다.
RSI, 52주 위치, 이동평균, 수익률을 종합해 매수·매도 시점 판정과 한 줄 근거를 한국어로 제공합니다."""


def _ai_batch_judgment(metrics: list[dict]) -> dict[str, dict]:
    """전 종목 1회 Gemini 호출. 실패 시 빈 dict 반환 → 룰 기반 폴백."""
    summary_lines = []
    for m in metrics:
        summary_lines.append(
            f"[{m['ticker']}] {m['name']} | RSI={m['rsi']} | "
            f"52w위치={m['week52_pos']}% | "
            f"MA50={'위' if m['above_ma50'] else '아래'} | "
            f"MA200={'위' if m['above_ma200'] else '아래'} | "
            f"골든크로스={'Y' if m['golden_cross'] else 'N'} | "
            f"1m={m['change_1m']}% | 3m={m['change_3m']}% | 1y={m['change_1y']}%"
        )
    summary = "\n".join(summary_lines)

    prompt = f"""다음은 ETF·미국주식·한국주식 {len(metrics)}종목의 기술 지표입니다.

{summary}

각 종목에 대해 매수·매도 시점을 판정하세요. 코드블록 없이 순수 JSON만 응답:
{{
  "judgments": [
    {{"ticker": "QQQ", "signal": "STRONG_BUY|BUY|HOLD|SELL|STRONG_SELL", "reason": "한 줄 근거 (한국어, 35자 이내)"}}
  ]
}}

판정 가이드:
- STRONG_BUY: RSI 30↓ 과매도 + 52w 35%↓ 저점권, 또는 골든크로스 직후
- BUY: RSI 30~45 + MA50 위 + 상승 모멘텀
- HOLD: RSI 45~65 + 횡보 또는 추세 불분명
- SELL: RSI 65~75 + 52w 80%↑ 고점권
- STRONG_SELL: RSI 75↑ + 52w 95%↑ 고점, 또는 데드크로스 직후

반드시 입력된 {len(metrics)}개 종목 모두에 대해 응답하세요."""

    try:
        raw = call_gemini(prompt, SYSTEM)
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        parsed = json.loads(match.group() if match else raw)
        result = {}
        for j in parsed.get("judgments", []):
            if "ticker" in j:
                result[j["ticker"]] = {
                    "signal": j.get("signal", "HOLD"),
                    "reason": j.get("reason", ""),
                }
        return result
    except Exception as e:
        print(f"[etf_signals] Gemini 배치 실패: {e}")
        return {}


def _fallback_signal(m: dict) -> dict:
    """Gemini 실패 시 룰 기반 폴백."""
    rsi = m["rsi"]
    pos = m["week52_pos"]
    if rsi <= 30 and pos <= 35:
        return {"signal": "STRONG_BUY", "reason": f"RSI {rsi} 과매도, 52주 저점권"}
    if rsi <= 40 and m["above_ma50"]:
        return {"signal": "BUY",        "reason": f"RSI {rsi}, 50일선 위 매수 영역"}
    if rsi >= 75 and pos >= 90:
        return {"signal": "STRONG_SELL","reason": f"RSI {rsi} 과매수, 52주 고점"}
    if rsi >= 65:
        return {"signal": "SELL",       "reason": f"RSI {rsi} 고점권, 차익실현 고려"}
    if not m["golden_cross"] and not m["above_ma200"]:
        return {"signal": "SELL",       "reason": "데드크로스, 200일선 아래"}
    return {"signal": "HOLD", "reason": f"RSI {rsi} 중립 구간"}


# ─────────────────────────────────────────────
# 메인 엔트리
# ─────────────────────────────────────────────

def get_etf_signals() -> dict:
    """전체 파이프라인. 스케줄러에서만 호출."""
    metrics_list: list[dict] = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(_fetch_history, item["ticker"]): item for item in ALL_ITEMS}
        for fut in as_completed(futures):
            item = futures[fut]
            hist = fut.result()
            if hist:
                metrics_list.append(_calc_metrics(item, hist))

    judgments = _ai_batch_judgment(metrics_list)

    etf_set = {x["ticker"] for x in ETF_LIST}
    us_set  = {x["ticker"] for x in US_STOCK_LIST}

    etfs, us, kr = [], [], []
    for m in metrics_list:
        j = judgments.get(m["ticker"]) or _fallback_signal(m)
        m["signal"] = j["signal"]
        m["reason"] = j["reason"]
        if m["ticker"] in etf_set:
            etfs.append(m)
        elif m["ticker"] in us_set:
            us.append(m)
        else:
            kr.append(m)

    for lst in (etfs, us, kr):
        lst.sort(key=lambda x: SIGNAL_ORDER.get(x["signal"], 5))

    return {
        "etfs":       etfs,
        "us_stocks":  us,
        "kr_stocks":  kr,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

"""오늘의 투자포인트 — S&P 500 대표 50종목 AI 분석

파이프라인:
  yfinance(30d 수익률·거래량) + NewsAPI(헤드라인 3개)
    → FinBERT(HF Inference API) 감성 분석
    → 종합 스코어 계산
    → 상위 3 매수 / 하위 3 매도 / 거래량 이상치 3 관심
    → Gemini 2.5 Flash 추천 이유 1~2문장 (한국어)
    → 6시간 캐시
"""

import os
import time
import requests
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
HF_API_TOKEN = os.getenv("HF_API_TOKEN", "")
genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))

_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
})

PICKS_TTL = 21600  # 6시간
_picks_cache: dict = {"data": None, "ts": 0}

SP50 = [
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "BRK-B", "JPM", "V",
    "UNH",  "XOM",  "JNJ",  "WMT",  "MA",   "PG",   "HD",   "CVX",   "MRK", "ABBV",
    "COST", "PEP",  "KO",   "BAC",  "LLY",  "AVGO", "CSCO", "TMO",   "ACN", "MCD",
    "ABT",  "ORCL", "NKE",  "DHR",  "PM",   "IBM",  "INTC", "GE",    "QCOM","AMD",
    "AMGN", "TXN",  "SBUX", "LOW",  "INTU", "CAT",  "AXP",  "SPGI",  "GS",  "OXY",
]

TICKER_NAMES = {
    "AAPL": "Apple Inc.",          "MSFT": "Microsoft Corp.",     "NVDA": "NVIDIA Corp.",
    "AMZN": "Amazon.com Inc.",     "GOOGL": "Alphabet Inc.",      "META": "Meta Platforms",
    "TSLA": "Tesla Inc.",          "BRK-B": "Berkshire Hathaway", "JPM": "JPMorgan Chase",
    "V":    "Visa Inc.",           "UNH": "UnitedHealth Group",   "XOM": "Exxon Mobil",
    "JNJ":  "Johnson & Johnson",   "WMT": "Walmart Inc.",         "MA": "Mastercard Inc.",
    "PG":   "Procter & Gamble",    "HD":  "Home Depot",           "CVX": "Chevron Corp.",
    "MRK":  "Merck & Co.",         "ABBV": "AbbVie Inc.",         "COST": "Costco Wholesale",
    "PEP":  "PepsiCo Inc.",        "KO":  "Coca-Cola Co.",        "BAC": "Bank of America",
    "LLY":  "Eli Lilly & Co.",     "AVGO": "Broadcom Inc.",       "CSCO": "Cisco Systems",
    "TMO":  "Thermo Fisher",       "ACN": "Accenture PLC",        "MCD": "McDonald's Corp.",
    "ABT":  "Abbott Laboratories", "ORCL": "Oracle Corp.",        "NKE": "Nike Inc.",
    "DHR":  "Danaher Corp.",       "PM":  "Philip Morris",        "IBM": "IBM Corp.",
    "INTC": "Intel Corp.",         "GE":  "GE Aerospace",         "QCOM": "Qualcomm Inc.",
    "AMD":  "Advanced Micro Devices", "AMGN": "Amgen Inc.",       "TXN": "Texas Instruments",
    "SBUX": "Starbucks Corp.",     "LOW": "Lowe's Companies",     "INTU": "Intuit Inc.",
    "CAT":  "Caterpillar Inc.",    "AXP": "American Express",     "SPGI": "S&P Global Inc.",
    "GS":   "Goldman Sachs",       "OXY": "Occidental Petroleum",
}


# ─────────────────────────────────────────────
# 가격 데이터 (Yahoo Finance REST, 한국 IP 차단 우회)
# ─────────────────────────────────────────────

def _fetch_price_one(ticker: str) -> dict | None:
    """Yahoo Finance REST API로 30일 가격 데이터 조회"""
    try:
        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=35d"
        r = _session.get(url, timeout=8)
        r.raise_for_status()
        result = r.json()["chart"]["result"][0]
        closes = [c for c in result["indicators"]["quote"][0]["close"] if c is not None]
        volumes = [v for v in result["indicators"]["quote"][0]["volume"] if v is not None]
        if len(closes) < 5:
            return None
        current = closes[-1]
        prev_30d = closes[0]
        momentum_30d = round((current - prev_30d) / prev_30d * 100, 2)
        change_1d = round((closes[-1] - closes[-2]) / closes[-2] * 100, 2) if len(closes) > 1 else 0
        avg_vol_20 = sum(volumes[-20:]) / len(volumes[-20:]) if len(volumes) >= 20 else sum(volumes) / len(volumes) if volumes else 1
        today_vol = volumes[-1] if volumes else avg_vol_20
        volume_ratio = round(today_vol / avg_vol_20, 2) if avg_vol_20 > 0 else 1.0
        return {
            "ticker": ticker,
            "price": round(current, 2),
            "change_1d": change_1d,
            "momentum_30d": momentum_30d,
            "volume_ratio": volume_ratio,
        }
    except Exception:
        return None


def _fetch_all_prices(tickers: list[str]) -> dict[str, dict]:
    """ThreadPoolExecutor로 50종목 병렬 조회"""
    results = {}
    with ThreadPoolExecutor(max_workers=12) as ex:
        futures = {ex.submit(_fetch_price_one, t): t for t in tickers}
        for fut in as_completed(futures):
            ticker = futures[fut]
            data = fut.result()
            if data:
                results[ticker] = data
    return results


# ─────────────────────────────────────────────
# 뉴스 (NewsAPI)
# ─────────────────────────────────────────────

def _fetch_news_one(ticker: str) -> list[str]:
    """NewsAPI에서 종목 헤드라인 최대 3개 반환"""
    if not NEWS_API_KEY:
        return []
    try:
        r = _session.get(
            "https://newsapi.org/v2/everything",
            params={"q": ticker, "language": "en", "sortBy": "publishedAt", "pageSize": 3, "apiKey": NEWS_API_KEY},
            timeout=8,
        )
        r.raise_for_status()
        articles = r.json().get("articles", [])
        return [a["title"] for a in articles if a.get("title")]
    except Exception:
        return []


# ─────────────────────────────────────────────
# FinBERT 감성 분석 (HF Inference API)
# ─────────────────────────────────────────────

def _finbert_sentiment(texts: list[str]) -> float:
    """FinBERT로 텍스트 배치 감성 분석. 평균 감성 점수(-1 ~ +1) 반환.
    HF_API_TOKEN 없거나 실패 시 0 폴백."""
    if not texts or not HF_API_TOKEN:
        return 0.0
    try:
        r = requests.post(
            "https://api-inference.huggingface.co/models/ProsusAI/finbert",
            headers={"Authorization": f"Bearer {HF_API_TOKEN}"},
            json={"inputs": texts[:3]},
            timeout=15,
        )
        r.raise_for_status()
        results = r.json()
        if not isinstance(results, list):
            return 0.0
        score_map = {"positive": 1.0, "neutral": 0.0, "negative": -1.0}
        scores = []
        for item in results:
            if isinstance(item, list):
                best = max(item, key=lambda x: x.get("score", 0))
                label = best.get("label", "neutral").lower()
                scores.append(score_map.get(label, 0.0))
        return round(sum(scores) / len(scores), 3) if scores else 0.0
    except Exception:
        return 0.0


# ─────────────────────────────────────────────
# Gemini 추천 이유 생성
# ─────────────────────────────────────────────

def _gemini_reason(ticker: str, name: str, momentum: float, sentiment: float, volume_ratio: float, pick_type: str) -> str:
    """Gemini 2.5 Flash로 추천 이유 1~2문장 생성 (한국어). 실패 시 폴백 문자열."""
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        type_kr = {"buy": "매수 추천", "sell": "매도 추천", "watch": "관심 종목"}[pick_type]
        prompt = (
            f"종목: {ticker} ({name})\n"
            f"30일 수익률: {momentum:+.1f}%\n"
            f"뉴스 감성 점수: {sentiment:+.2f} (-1=부정, 0=중립, +1=긍정)\n"
            f"거래량 비율 (오늘/20일평균): {volume_ratio:.1f}x\n"
            f"판단: {type_kr}\n\n"
            "위 데이터를 근거로 이 종목이 왜 지금 이 판단을 받았는지 "
            "1~2문장으로 간결하게 설명해. 한국어로. 수치를 직접 언급해."
        )
        resp = model.generate_content(prompt)
        text = resp.text.strip()
        return text[:120] if len(text) > 120 else text
    except Exception:
        return "데이터 분석 중"


# ─────────────────────────────────────────────
# 종합 스코어 계산
# ─────────────────────────────────────────────

def _normalize(values: list[float]) -> list[float]:
    """리스트를 -1 ~ +1 백분위로 정규화"""
    if not values:
        return values
    sorted_v = sorted(values)
    n = len(sorted_v)
    return [(sorted_v.index(v) / max(n - 1, 1)) * 2 - 1 for v in values]


def _compute_scores(prices: dict[str, dict]) -> dict[str, float]:
    """종목별 종합 스코어 계산"""
    tickers = list(prices.keys())
    momentum_raw = [prices[t]["momentum_30d"] for t in tickers]
    volume_raw   = [prices[t]["volume_ratio"] for t in tickers]

    momentum_norm = _normalize(momentum_raw)
    volume_norm   = _normalize(volume_raw)

    scores = {}
    for i, t in enumerate(tickers):
        scores[t] = round(
            momentum_norm[i] * 0.6 + volume_norm[i] * 0.2,
            4
        )
    return scores


# ─────────────────────────────────────────────
# 메인 엔트리
# ─────────────────────────────────────────────

def get_today_picks() -> dict:
    """캐시 적중 시 즉시 반환, 만료 시 전체 파이프라인 실행"""
    now = time.time()
    if _picks_cache["data"] and now - _picks_cache["ts"] < PICKS_TTL:
        return _picks_cache["data"]

    # 1. 가격 데이터 수집
    prices = _fetch_all_prices(SP50)
    if len(prices) < 10:
        return {"error": "가격 데이터 부족", "buy": [], "sell": [], "watch": []}

    # 2. 뉴스 + FinBERT 감성 분석 (뉴스 있는 종목만)
    sentiments: dict[str, float] = {}
    top_tickers = list(prices.keys())[:30]  # API 절약: 상위 30종목만
    with ThreadPoolExecutor(max_workers=6) as ex:
        news_futures = {ex.submit(_fetch_news_one, t): t for t in top_tickers}
        news_map: dict[str, list[str]] = {}
        for fut in as_completed(news_futures):
            t = news_futures[fut]
            news_map[t] = fut.result()

    for t, headlines in news_map.items():
        sentiments[t] = _finbert_sentiment(headlines)

    # 3. 스코어 계산 (감성 반영)
    base_scores = _compute_scores(prices)
    tickers_list = list(prices.keys())
    sentiment_values = [sentiments.get(t, 0.0) for t in tickers_list]
    sentiment_norm = _normalize(sentiment_values)
    final_scores: dict[str, float] = {}
    for i, t in enumerate(tickers_list):
        final_scores[t] = round(
            base_scores[t] + sentiment_norm[i] * 0.2,
            4
        )

    # 4. 매수 / 매도 / 관심 분류
    sorted_by_score = sorted(final_scores.items(), key=lambda x: -x[1])
    buy_tickers   = [t for t, _ in sorted_by_score[:3]]
    sell_tickers  = [t for t, _ in sorted_by_score[-3:]]
    rest          = [t for t, _ in sorted_by_score[3:-3]]
    watch_tickers = sorted(rest, key=lambda t: -prices[t]["volume_ratio"])[:3]

    # 5. Gemini 이유 생성 (9종목)
    def _build_card(ticker: str, pick_type: str) -> dict:
        p = prices[ticker]
        reason = _gemini_reason(
            ticker, TICKER_NAMES.get(ticker, ticker),
            p["momentum_30d"], sentiments.get(ticker, 0.0),
            p["volume_ratio"], pick_type,
        )
        return {
            "ticker":       ticker,
            "name":         TICKER_NAMES.get(ticker, ticker),
            "price":        p["price"],
            "change_pct":   p["change_1d"],
            "momentum_30d": p["momentum_30d"],
            "sentiment":    sentiments.get(ticker, 0.0),
            "volume_ratio": p["volume_ratio"],
            "reason":       reason,
        }

    buy_cards   = [_build_card(t, "buy")   for t in buy_tickers]
    sell_cards  = [_build_card(t, "sell")  for t in sell_tickers]
    watch_cards = [_build_card(t, "watch") for t in watch_tickers]

    generated_at = datetime.now(timezone.utc)
    result = {
        "buy":          buy_cards,
        "sell":         sell_cards,
        "watch":        watch_cards,
        "generated_at": generated_at.isoformat(),
        "next_update":  datetime.fromtimestamp(now + PICKS_TTL, tz=timezone.utc).isoformat(),
    }
    _picks_cache["data"] = result
    _picks_cache["ts"]   = now
    return result

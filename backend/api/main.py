import asyncio
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.services.investors import get_investor
from backend.services.news import fetch_investor_news, fetch_stock_news
from backend.services.financial import get_stock_data, get_multiple_stocks_parallel
from backend.services.coins import get_coin_detail
from backend.services.db_cache import db_get_stale, db_set

@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.services.scheduler import create_scheduler, warm_all_caches
    scheduler = create_scheduler()
    scheduler.start()
    asyncio.create_task(warm_all_caches())
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Whalyx API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_executor = ThreadPoolExecutor(max_workers=8)


def _run(fn, *args):
    """sync 함수를 현재 이벤트 루프에서 실행"""
    loop = asyncio.get_event_loop()
    return loop.run_in_executor(_executor, fn, *args)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "Whalyx API", "version": "2.0.0"}


@app.get("/debug/env")
def debug_env():
    import os
    key = os.getenv("GEMINI_API_KEY", "")
    sb_url = os.getenv("SUPABASE_URL", "")
    sb_key = os.getenv("SUPABASE_KEY", "")
    return {
        "GEMINI_API_KEY_set": bool(key),
        "GEMINI_API_KEY_prefix": key[:8] + "..." if key else "NOT SET",
        "SUPABASE_URL": sb_url[:40] + "..." if sb_url else "NOT SET",
        "SUPABASE_KEY_prefix": sb_key[:20] + "..." if sb_key else "NOT SET",
        "BOK_API_KEY_set": bool(os.getenv("BOK_API_KEY")),
    }


@app.get("/debug/gemini")
async def debug_gemini():
    """Gemini 직접 호출 테스트 — 에러 메시지 노출"""
    try:
        from backend.utils.gemini import call_gemini
        result = call_gemini("한국어로 '테스트 성공'이라고만 답하세요.")
        return {"status": "ok", "response": result}
    except Exception as e:
        return {"status": "error", "error": str(e), "type": type(e).__name__}


# ─────────────────────────────────────────────
# 투자자
# ─────────────────────────────────────────────

@app.get("/investors")
async def list_investors():
    """전체 투자자 목록 + 각 투자자 상위 3개 종목 주가 (DB-Only — 스케줄러 10분 주기)"""
    cached = await _run(db_get_stale, "investors_list")
    if cached:
        return cached
    return {"investors": []}


@app.get("/investors/{investor_id}")
async def get_investor_detail(investor_id: str):
    """투자자 상세 (DB-Only — 스케줄러가 1시간마다 Gemini 인사이트 포함 갱신)"""
    cache_key = f"investor_detail_{investor_id}"
    cached = await _run(db_get_stale, cache_key)
    if cached:
        return cached

    # DB에 없으면 Gemini 없이 주가+뉴스만 즉시 반환 (스케줄러가 나중에 insight 채움)
    investor = get_investor(investor_id)
    if not investor:
        raise HTTPException(status_code=404, detail="투자자를 찾을 수 없습니다")

    tickers = [p["ticker"] for p in investor["portfolio"]]
    prices_task = get_multiple_stocks_parallel(tickers)
    news_task = _run(fetch_investor_news, investor["name"])
    prices, news = await asyncio.gather(prices_task, news_task)

    portfolio_with_prices = [
        {
            **holding,
            "current_price": prices.get(holding["ticker"], {}).get("current_price"),
            "change_30d_pct": prices.get(holding["ticker"], {}).get("change_30d_pct"),
            "change_1d_pct": prices.get(holding["ticker"], {}).get("change_1d_pct"),
            "sector": prices.get(holding["ticker"], {}).get("sector", ""),
        }
        for holding in investor["portfolio"]
    ]

    result = {**investor, "portfolio": portfolio_with_prices, "news": news, "insight": ""}
    await _run(db_set, cache_key, result)
    return result


# ─────────────────────────────────────────────
# 종목
# ─────────────────────────────────────────────

@app.get("/stocks/hot")
async def hot_stocks():
    """유명 투자자들이 주목하는 핫 종목 (DB-Only — 스케줄러 10분 주기)"""
    cached = await _run(db_get_stale, "stocks_hot")
    if cached:
        return cached
    return {"stocks": []}


@app.get("/stocks/recommendations")
async def recommendations():
    """매수/매도 추천 종목 + 주가 (DB-Only — 스케줄러 10분 주기)"""
    cached = await _run(db_get_stale, "stocks_recommendations")
    if cached:
        return cached
    return {"buy": [], "sell": []}


@app.get("/stocks/{ticker}")
async def stock_detail(ticker: str, period: str = "30d"):
    """종목 상세 (DB-Only — 스케줄러가 1시간마다 Gemini 인사이트 포함 갱신)"""
    ticker = ticker.upper()
    cache_key = f"stock_detail_{ticker}_{period}"
    cached = await _run(db_get_stale, cache_key)
    if cached:
        return cached

    # DB에 없으면 Gemini 없이 주가+뉴스만 즉시 반환 (스케줄러가 나중에 insight 채움)
    data_task = _run(get_stock_data, ticker, period)
    news_task = _run(fetch_stock_news, ticker)
    data, news = await asyncio.gather(data_task, news_task)

    if "error" in data:
        raise HTTPException(status_code=404, detail="종목 데이터를 가져올 수 없습니다")

    result = {**data, "news": news, "insight": ""}
    await _run(db_set, cache_key, result)
    return result


# ─────────────────────────────────────────────
# 코인
# ─────────────────────────────────────────────

@app.get("/crypto")
async def crypto_markets():
    """코인 시장 데이터 + 최신 뉴스 (DB-Only — 스케줄러 10분 주기)"""
    cached = await _run(db_get_stale, "crypto")
    if cached:
        return cached
    return {"coins": [], "news": []}


@app.get("/crypto/{coin_id}")
async def crypto_detail(coin_id: str):
    """개별 코인 상세"""
    detail = await _run(get_coin_detail, coin_id)
    if not detail:
        raise HTTPException(status_code=404, detail="코인 데이터를 가져올 수 없습니다")
    news = await _run(fetch_stock_news, detail["symbol"])
    return {**detail, "news": news}


# ─────────────────────────────────────────────
# 광물/원자재
# ─────────────────────────────────────────────

@app.get("/commodities")
async def commodities():
    """광물/원자재 시장 데이터 + 뉴스 (DB-Only — 스케줄러 30분 주기)"""
    cached = await _run(db_get_stale, "commodities")
    if cached:
        return cached
    return {"commodities": [], "news": []}


# ─────────────────────────────────────────────
# 부동산
# ─────────────────────────────────────────────

@app.get("/realestate")
async def realestate():
    """한국 부동산 뉴스 + 주요 지표 (DB-Only — 스케줄러 1시간 주기)"""
    cached = await _run(db_get_stale, "realestate")
    if cached:
        return cached
    return {"indicators": [], "news": []}


# ─────────────────────────────────────────────
# 돈의 흐름 (Money Flow)
# ─────────────────────────────────────────────

@app.get("/money-flow")
async def money_flow():
    """금리·자산군별 수익률 — 돈의 흐름 파악 (DB-Only — 스케줄러 30분 주기)"""
    cached = await _run(db_get_stale, "money_flow")
    if cached:
        return cached
    return {"assets": [], "rate_signal": {"level": "mid", "message": "데이터를 불러오는 중입니다."}, "fed_rate": None, "korea_rates": None}


# ─────────────────────────────────────────────
# 채권 (Bonds)
# ─────────────────────────────────────────────

@app.get("/bonds")
async def bonds():
    """채권 시장 데이터 (DB-Only — 스케줄러 30분 주기)"""
    cached = await _run(db_get_stale, "bonds")
    if cached:
        return cached
    return {"data": {}, "news": []}


# ─────────────────────────────────────────────
# 오늘의 마켓 드라이버
# ─────────────────────────────────────────────

@app.get("/market-driver")
async def market_driver():
    """오늘의 마켓 드라이버 (DB-Only — 스케줄러가 30분마다 Gemini 분석 후 갱신)"""
    cached = await _run(db_get_stale, "market_driver")  # TTL 무시 — 스케줄러가 신선도 보장
    if cached:
        return cached
    return {"drivers": [], "updated_at": None}


# ─────────────────────────────────────────────
# AI 뉴스 분석
# ─────────────────────────────────────────────

@app.get("/news-ai")
async def news_ai():
    """전 자산군 뉴스 AI 분석 (DB-Only — 스케줄러 1시간 주기 Gemini 분석)"""
    cached = await _run(db_get_stale, "news_ai")
    if cached:
        return cached
    return {
        "sentiment": "Neutral",
        "sentiment_score": 50,
        "summary": "AI 뉴스 분석을 준비 중입니다. 잠시 후 새로고침해 주세요.",
        "themes": [],
        "news": [],
        "updated_at": None,
    }


# ─────────────────────────────────────────────
# 한국 금리 (Korea Rates)
# ─────────────────────────────────────────────

@app.get("/korea-rates")
async def korea_rates():
    """한국은행 ECOS API (DB-Only — 스케줄러 1시간 주기)"""
    cached = await _run(db_get_stale, "korea_rates")
    if cached:
        return cached
    return {}


# ─────────────────────────────────────────────
# 고래 신호 (Whale Signal)
# ─────────────────────────────────────────────

@app.get("/whale-signal")
async def whale_signal():
    """현재 시장 상황 종합 분석 (DB-Only — 스케줄러 6시간 주기 Gemini 분석)"""
    cached = await _run(db_get_stale, "whale_signal_full")
    if cached:
        return cached
    return {"signals": [], "market_news": [], "asia_news": []}


# ─────────────────────────────────────────────
# 오늘의 투자포인트
# ─────────────────────────────────────────────

@app.get("/today-picks")
async def today_picks():
    """오늘의 투자포인트 (DB-Only — 스케줄러가 6시간마다 FinBERT+Gemini 분석 후 갱신)"""
    cached = await _run(db_get_stale, "today_picks")  # TTL 무시 — 스케줄러가 신선도 보장
    if cached:
        return cached
    return {"buy": [], "sell": [], "watch": [], "updated_at": None}

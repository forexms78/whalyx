import asyncio
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.services.investors import get_investor
from backend.services.news import fetch_investor_news, fetch_stock_news
from backend.services.financial import get_stock_data, get_multiple_stocks_parallel
from backend.services.coins import get_coin_detail
from backend.services.db_cache import db_get_stale, db_set
from backend.services.quant_analyzer import analyze as quant_analyze, calculate_metrics, calculate_signal

@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.services.scheduler import create_scheduler, warm_all_caches
    from backend.services import ws_manager
    ws_manager.set_loop(asyncio.get_event_loop())
    scheduler = create_scheduler()
    scheduler.start()
    asyncio.create_task(warm_all_caches())

    # DART corp_code 테이블 초기화 (비어있을 때만 백그라운드 실행)
    try:
        from backend.services.db_cache import _get_client as _sb_init
        from backend.services.dart_service import build_corp_code_table
        count = _sb_init().table("dart_corp_codes").select("ticker", count="exact").limit(1).execute()
        if not count.data:
            import threading
            threading.Thread(target=build_corp_code_table, daemon=True).start()
            print("[startup] DART corp_code 테이블 백그라운드 빌드 시작")
    except Exception as _e:
        print(f"[startup] DART 초기화 스킵: {_e}")

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


@app.get("/debug/kis")
async def debug_kis():
    """KIS 설정 확인 + 토큰 발급 테스트"""
    import os
    from backend.services.kis_trader import BASE_URL, IS_MOCK, APP_KEY, ACCOUNT_NO
    result = {
        "IS_MOCK": IS_MOCK,
        "BASE_URL": BASE_URL,
        "KIS_MOCK_env": os.getenv("KIS_MOCK", "(not set)"),
        "APP_KEY_set": bool(APP_KEY),
        "ACCOUNT_NO": ACCOUNT_NO,
    }
    try:
        from backend.services.kis_trader import get_access_token
        token = await _run(get_access_token)
        result["token_ok"] = True
        result["token_prefix"] = token[:20] + "..."
    except Exception as e:
        result["token_ok"] = False
        result["token_error"] = str(e)
    return result


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
# 한국어 헤드라인 (Gemini 없음, 5분 RSS 캐시)
# ─────────────────────────────────────────────

@app.get("/headlines")
async def headlines(limit: int = 10):
    """한국어 Google News 최신 헤드라인 — Gemini 분석 없이 RSS 직접 반환 (5분 캐시)"""
    from backend.services.news import fetch_korean_headlines
    items = await _run(fetch_korean_headlines, limit)
    return {"headlines": items, "total": len(items)}


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

@app.get("/today-movers")
async def today_movers():
    """카테고리별 주요 자산 급등·급락 + 관련 뉴스 (기존 DB 캐시 집계, 실시간성 보장)"""
    crypto_data, commodity_data, stocks_data, re_data, news_ai = await asyncio.gather(
        _run(db_get_stale, "crypto"),
        _run(db_get_stale, "commodities"),
        _run(db_get_stale, "stocks_hot"),
        _run(db_get_stale, "realestate"),
        _run(db_get_stale, "news_ai"),
    )

    # 카테고리별 뉴스 분류
    all_news = (news_ai or {}).get("news", [])
    news_by_cat: dict[str, list] = {}
    for n in all_news:
        cat = n.get("category", "")
        news_by_cat.setdefault(cat, []).append(n)

    # 코인: 24h 변동 기준 급등/급락 각 3개
    coins = sorted(
        (c for c in (crypto_data or {}).get("coins", []) if c.get("price_change_24h") is not None),
        key=lambda x: x["price_change_24h"],
    )
    crypto_gainers = coins[-3:][::-1]
    crypto_losers  = coins[:3]

    # 광물: 30d 변동 기준 급등/급락 각 3개
    comms = sorted(
        (c for c in (commodity_data or {}).get("commodities", []) if c.get("change_30d_pct") is not None),
        key=lambda x: x["change_30d_pct"],
    )
    comm_gainers = comms[-3:][::-1]
    comm_losers  = comms[:3]

    # 주식: 30d 수익률 기준 급등/급락 각 3개 (change_1d_pct 우선)
    def stock_sort_key(s):
        return s.get("change_1d_pct") if s.get("change_1d_pct") is not None else s.get("change_30d_pct", 0)

    stocks_list = sorted(
        (s for s in (stocks_data or {}).get("stocks", []) if s.get("change_30d_pct") is not None),
        key=stock_sort_key,
    )
    stock_gainers = stocks_list[-3:][::-1]
    stock_losers  = stocks_list[:3]

    return {
        "stocks": {
            "gainers": stock_gainers,
            "losers":  stock_losers,
            "news":    news_by_cat.get("주식", [])[:4],
            "period":  "30d",
        },
        "crypto": {
            "gainers": crypto_gainers,
            "losers":  crypto_losers,
            "news":    news_by_cat.get("코인", [])[:4],
            "period":  "24h",
        },
        "commodities": {
            "gainers": comm_gainers,
            "losers":  comm_losers,
            "news":    news_by_cat.get("광물", [])[:4],
            "period":  "30d",
        },
        "realestate": {
            "indicators": (re_data or {}).get("indicators", []),
            "news": (re_data or {}).get("news", [])[:4] or news_by_cat.get("부동산", [])[:4],
        },
    }


@app.get("/today-picks")
async def today_picks():
    """오늘의 투자포인트 — 전 자산군 뉴스 AI 분석 (news_ai 데이터 재활용, 1시간 주기)"""
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


# ── Quant: 종목 ────────────────────────────────────────────────────────────────
from backend.services.db_cache import _get_client as _sb

@app.post("/quant/stocks")
async def add_quant_stock(body: dict):
    ticker = body.get("ticker", "").upper()
    market = body.get("market", "US")
    name = body.get("name", ticker)
    if not ticker:
        return {"error": "ticker 필수"}
    data = {"ticker": ticker, "market": market, "name": name}
    result = _sb().table("quant_stocks").upsert(data, on_conflict="ticker").execute()
    return result.data[0] if result.data else {}

@app.get("/quant/stocks")
async def list_quant_stocks():
    result = _sb().table("quant_stocks").select("*").order("added_at", desc=True).execute()
    return result.data or []

@app.get("/quant/stocks/{ticker}")
async def get_quant_stock(ticker: str):
    result = _sb().table("quant_stocks").select("*").eq("ticker", ticker.upper()).execute()
    return result.data[0] if result.data else {}

# ── Quant: 분석 ────────────────────────────────────────────────────────────────
@app.post("/quant/analyze")
async def quant_analyze_text(body: dict):
    text = body.get("text", "")
    ticker = body.get("ticker", "")
    target_pe = body.get("target_pe", 30)
    if not text:
        return {"error": "text 필수"}

    result = await _run(quant_analyze, text, target_pe)
    if result.get("error"):
        return result

    resolved_ticker = (result.get("ticker") or ticker).upper()
    if resolved_ticker:
        _sb().table("quant_stocks").upsert({
            "ticker": resolved_ticker,
            "market": result.get("market", "US"),
            "name": result.get("name", resolved_ticker),
            "current_price": result.get("current_price"),
            "forward_eps": result.get("forward_eps"),
            "bps": result.get("bps"),
            "eps_growth_rate": result.get("eps_growth_rate"),
            "target_pe": target_pe,
            "overhang_note": result.get("overhang_note"),
        }, on_conflict="ticker").execute()

        stock = _sb().table("quant_stocks").select("id").eq("ticker", resolved_ticker).execute()
        if stock.data:
            _sb().table("journal_entries").insert({
                "stock_id": stock.data[0]["id"],
                "action": "note",
                "price": result.get("current_price"),
                "analysis_text": text,
                "forward_pe": result.get("forward_pe"),
                "fair_value_pe": result.get("fair_value_pe"),
                "fair_value_graham": result.get("fair_value_graham"),
                "fair_value_peg": result.get("fair_value_peg"),
                "signal": result.get("signal"),
            }).execute()

    return result

# ── Quant: 일지 ────────────────────────────────────────────────────────────────
@app.get("/quant/journal/{ticker}")
async def get_journal(ticker: str):
    stock = _sb().table("quant_stocks").select("id").eq("ticker", ticker.upper()).execute()
    if not stock.data:
        return []
    entries = _sb().table("journal_entries")\
        .select("*")\
        .eq("stock_id", stock.data[0]["id"])\
        .order("created_at", desc=True)\
        .execute()
    return entries.data or []

@app.post("/quant/journal")
async def add_journal(body: dict):
    ticker = body.get("ticker", "").upper()
    stock = _sb().table("quant_stocks").select("id").eq("ticker", ticker).execute()
    if not stock.data:
        return {"error": "종목을 먼저 추가하세요"}
    data = {
        "stock_id": stock.data[0]["id"],
        "action": body.get("action", "note"),
        "price": body.get("price"),
        "quantity": body.get("quantity"),
        "analysis_text": body.get("analysis_text", ""),
    }
    result = _sb().table("journal_entries").insert(data).execute()
    return result.data[0] if result.data else {}

# ── AutoTrade: 상태·이력·시그널 ────────────────────────────────────────────────
from datetime import datetime as _dt

@app.get("/autotrade/status")
async def autotrade_status():
    from zoneinfo import ZoneInfo
    today_kst = _dt.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d")

    # 체결 이력은 DB에서 독립 조회 (KIS API 실패와 무관)
    try:
        trades_today = _sb().table("auto_trades")\
            .select("*")\
            .gte("executed_at", today_kst)\
            .execute().data or []
    except Exception:
        trades_today = []

    # 보유 종목 조회 — 실패해도 system_on은 True (스케줄러는 별도 프로세스)
    holdings = []
    holdings_error = None
    try:
        from backend.services.kis_trader import get_holdings as kis_holdings
        holdings = await _run(kis_holdings)
    except Exception as e:
        holdings_error = str(e)
        print(f"[status] 보유종목 조회 실패: {e}")

    total_invested = sum(h["current_price"] * h["quantity"] for h in holdings)
    total_pnl = sum((h["current_price"] - h["avg_price"]) * h["quantity"] for h in holdings)
    return {
        "system_on": True,
        "trades_today": len(trades_today),
        "total_invested": round(total_invested),
        "total_pnl_pct": round(total_pnl / total_invested * 100, 2) if total_invested else 0,
        "holdings": holdings,
        **({"holdings_error": holdings_error} if holdings_error else {}),
    }

@app.get("/autotrade/account")
async def autotrade_account():
    """계좌 잔고 상세 — 예수금·총평가·매입금액·평가손익·수익률"""
    try:
        from backend.services.kis_trader import get_account_summary
        return await _run(get_account_summary)
    except Exception as e:
        return {"error": str(e)}


@app.post("/autotrade/prescan")
async def trigger_prescan():
    """수동 전종목 프리스캔 트리거 — 백그라운드 실행. 1~3분 후 /autotrade/signals로 갱신 확인.
    yfinance 600종목 다운로드가 Render proxy timeout(100s) 초과하므로 fire-and-forget."""
    from backend.services.market_scanner import prescan_golden_cross
    import asyncio

    async def _bg():
        try:
            await _run(prescan_golden_cross)
        except Exception as e:
            print(f"[prescan bg] error: {e}")

    asyncio.create_task(_bg())
    return {"started": True, "message": "프리스캔 백그라운드 시작 — 1~3분 후 /autotrade/signals 확인"}


@app.get("/autotrade/trades")
async def autotrade_trades():
    result = _sb().table("auto_trades")\
        .select("*")\
        .order("executed_at", desc=True)\
        .limit(50)\
        .execute()
    return result.data or []

@app.get("/autotrade/signals")
async def autotrade_signals():
    from backend.services.quant_scheduler import get_universe_signals
    return await _run(get_universe_signals)

@app.get("/autotrade/scan-logs")
async def autotrade_scan_logs():
    """직전 자동매매 스캔 결과 — 종목별 매수/거절 사유 포함"""
    from backend.services.db_cache import db_get_stale
    log = await _run(db_get_stale, "quant_scan_log")
    if not log:
        return {
            "scan_at": None, "status": "no_data",
            "summary": "아직 스캔이 실행되지 않았습니다 (장 시간 내 10분 단위로 실행)",
            "logs": [],
        }
    return log

@app.get("/autotrade/watchlist")
async def autotrade_watchlist():
    from backend.services.quant_scheduler import _ensure_universe
    await _run(_ensure_universe)
    result = _sb().table("autotrade_watchlist").select("*").order("ticker").execute()
    return result.data or []

def _resolve_stock_name(ticker: str, market: str) -> str:
    if market == "KR":
        # 1순위: DART DB (corp_name — 이미 수집된 안정적 데이터)
        try:
            from backend.services.db_cache import _get_client as _sb2
            row = _sb2().table("dart_corp_codes").select("corp_name").eq("ticker", ticker).maybe_single().execute()
            if row and row.data and row.data.get("corp_name"):
                return row.data["corp_name"]
        except Exception as e:
            print(f"[resolve_name] DART DB 조회 실패 {ticker}: {e}")

        # 2순위: KIS 실시간 API
        try:
            from backend.services.kis_trader import _headers, BASE_URL
            import requests as _req
            res = _req.get(
                f"{BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price",
                headers=_headers("FHKST01010100"),
                params={"fid_cond_mrkt_div_code": "J", "fid_input_iscd": ticker},
                timeout=5,
            )
            name = res.json().get("output", {}).get("hts_kor_isnm", "").strip()
            if name:
                return name
        except Exception as e:
            print(f"[resolve_name] KIS API 실패 {ticker}: {e}")

        return ticker

    else:
        try:
            import yfinance as yf
            info = yf.Ticker(ticker).info
            return info.get("shortName") or info.get("longName") or ticker
        except Exception as e:
            print(f"[resolve_name] yfinance 실패 {ticker}: {e}")
            return ticker


@app.post("/autotrade/watchlist/refresh-names")
async def refresh_watchlist_names():
    """종목명이 ticker와 동일한 항목을 일괄 재조회·업데이트"""
    rows = _sb().table("autotrade_watchlist").select("ticker, name, market").execute().data or []
    updated, failed = [], []
    for row in rows:
        ticker = row["ticker"]
        market = (row.get("market") or "KR").upper()
        current_name = row.get("name", "")
        # 이름이 ticker와 같거나 숫자로만 이루어진 경우 재조회
        if current_name == ticker or current_name.isdigit():
            new_name = await _run(_resolve_stock_name, ticker, market)
            if new_name and new_name != ticker:
                _sb().table("autotrade_watchlist").update({"name": new_name}).eq("ticker", ticker).execute()
                updated.append({"ticker": ticker, "old": current_name, "new": new_name})
            else:
                failed.append({"ticker": ticker, "reason": "이름 조회 실패"})
    return {"updated": updated, "failed": failed, "total_checked": len(rows)}


@app.post("/autotrade/watchlist")
async def add_to_watchlist(body: dict):
    ticker = body.get("ticker", "").strip().upper()
    market = body.get("market", "KR").upper()
    if not ticker:
        return {"error": "ticker 필수"}
    name = await _run(_resolve_stock_name, ticker, market)
    result = _sb().table("autotrade_watchlist").upsert(
        {"ticker": ticker, "name": name, "market": market}, on_conflict="ticker"
    ).execute()
    return result.data[0] if result.data else {}

@app.delete("/autotrade/watchlist/{ticker}")
async def remove_from_watchlist(ticker: str):
    _sb().table("autotrade_watchlist").delete().eq("ticker", ticker).execute()
    return {"ok": True}


# ── 백테스트 ────────────────────────────────────────────────────────────────────
@app.get("/autotrade/backtest/{ticker}")
async def backtest_ticker(ticker: str, market: str = "KR", days: int = 180):
    """단일 종목 백테스트 (최대 200일)"""
    from backend.services.backtest import run_backtest
    days = min(days, 200)
    try:
        result = await _run(run_backtest, ticker.upper(), market.upper(), days)
        return result
    except Exception as e:
        return {"error": str(e)}


@app.post("/autotrade/backtest/portfolio")
async def backtest_portfolio(body: dict):
    """유니버스 전체 포트폴리오 백테스트"""
    from backend.services.backtest import run_portfolio_backtest
    days    = min(body.get("days", 180), 200)
    tickers = body.get("tickers")
    if not tickers:
        # 전체 유니버스 사용
        rows    = _sb().table("autotrade_watchlist").select("ticker, market").execute().data or []
        tickers = rows
    try:
        result = await _run(run_portfolio_backtest, tickers, days)
        return result
    except Exception as e:
        return {"error": str(e)}


@app.get("/autotrade/financial-filter/{ticker}")
async def financial_filter_check(ticker: str, market: str = "KR"):
    """5단계 재무 필터 결과 확인"""
    from backend.services.financial_filter import passes_5stage_filter
    try:
        ok, reason, fd = await _run(passes_5stage_filter, ticker.upper(), market.upper())
        return {"ticker": ticker, "pass": ok, "reason": reason, "fundamentals": fd}
    except Exception as e:
        return {"error": str(e)}


@app.get("/autotrade/vkospi")
async def get_vkospi_endpoint():
    """VKOSPI 현재 수치"""
    from backend.services.kis_trader import get_vkospi
    v = await _run(get_vkospi)
    return {"vkospi": v, "halve_threshold": 25.0, "position_mult": 0.5 if (v or 0) >= 25.0 else 1.0}


@app.get("/autotrade/trades/{trade_id}/details")
async def trade_details(trade_id: int):
    """매매 상세 분석 기록 조회"""
    result = _sb().table("auto_trades").select("*").eq("id", trade_id).single().execute()
    if not result.data:
        raise HTTPException(404, "거래 기록 없음")
    return result.data


# ── WebSocket — 실시간 매매 알림 ─────────────────────────────────────────────────
@app.websocket("/ws/signals")
async def ws_signals(ws: WebSocket):
    from backend.services import ws_manager
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # ping 유지
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)

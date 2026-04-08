import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.services.investors import (
    get_all_investors, get_investor,
    get_hot_tickers, get_buy_recommendations, get_sell_recommendations,
)
from backend.services.news import (
    fetch_investor_news, fetch_stock_news,
    fetch_crypto_news, fetch_realestate_news,
    fetch_commodity_news, fetch_bond_news, fetch_market_news_all,
    fetch_stock_market_news, fetch_asia_market_news, fetch_top_headlines,
)
from backend.services.financial import get_stock_data, get_multiple_stocks_parallel
from backend.services.ai_summary import generate_investor_insight, generate_stock_insight, generate_news_analysis, generate_market_drivers
from backend.services.coins import get_coin_markets, get_coin_detail
from backend.services.commodities import get_all_commodities
from backend.services.whale_signal import get_whale_signal
from backend.services.korea_rates import get_korea_rates
from backend.services.fed_rate import get_fed_rate
from backend.services.today_picks import get_today_picks
from backend.services.db_cache import db_get, db_set

app = FastAPI(title="Whalyx API", version="2.0.0")

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
    return {
        "GEMINI_API_KEY_set": bool(key),
        "GEMINI_API_KEY_prefix": key[:8] + "..." if key else "NOT SET",
        "SUPABASE_URL_set": bool(os.getenv("SUPABASE_URL")),
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
    """전체 투자자 목록 + 각 투자자 상위 3개 종목 주가 (병렬 조회)"""
    investors = get_all_investors()
    all_tickers = list({t for inv in investors for t in inv["top_holdings"]})
    prices = await get_multiple_stocks_parallel(all_tickers)

    result = []
    for inv in investors:
        result.append({
            **inv,
            "holdings_data": [
                {
                    "ticker": t,
                    "price": prices.get(t, {}).get("current_price"),
                    "change_1d_pct": prices.get(t, {}).get("change_1d_pct"),
                    "change_30d_pct": prices.get(t, {}).get("change_30d_pct"),
                }
                for t in inv["top_holdings"]
            ],
        })
    return {"investors": result}


@app.get("/investors/{investor_id}")
async def get_investor_detail(investor_id: str):
    """투자자 상세: 포트폴리오 + 주가 + 뉴스 + AI 인사이트 (병렬)"""
    investor = get_investor(investor_id)
    if not investor:
        raise HTTPException(status_code=404, detail="투자자를 찾을 수 없습니다")

    tickers = [p["ticker"] for p in investor["portfolio"]]

    # 주가·뉴스 병렬 조회
    prices_task = get_multiple_stocks_parallel(tickers)
    news_task = _run(fetch_investor_news, investor["name"])
    prices, news = await asyncio.gather(prices_task, news_task)

    news_titles = [n["title"] for n in news if n.get("title")]
    insight = await _run(
        generate_investor_insight,
        investor["name"], investor["firm"],
        investor["recent_moves"], news_titles,
    )

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

    return {**investor, "portfolio": portfolio_with_prices, "news": news, "insight": insight}


# ─────────────────────────────────────────────
# 종목
# ─────────────────────────────────────────────

@app.get("/stocks/hot")
async def hot_stocks():
    """유명 투자자들이 주목하는 핫 종목"""
    tickers = get_hot_tickers()
    stocks = await get_multiple_stocks_parallel(tickers)
    result = [data for ticker in tickers if "error" not in (data := stocks.get(ticker, {}))]
    return {"stocks": result}


@app.get("/stocks/recommendations")
async def recommendations():
    """매수/매도 추천 종목 + 실시간 주가"""
    buys = get_buy_recommendations()
    sells = get_sell_recommendations()

    buy_tickers = [r["ticker"] for r in buys]
    sell_tickers = [r["ticker"] for r in sells]
    all_tickers = list(set(buy_tickers + sell_tickers))

    prices = await get_multiple_stocks_parallel(all_tickers)

    buy_result = [
        {**r, **{k: prices.get(r["ticker"], {}).get(k) for k in ["current_price", "change_30d_pct", "change_1d_pct"]}}
        for r in buys
    ]
    sell_result = [
        {**r, **{k: prices.get(r["ticker"], {}).get(k) for k in ["current_price", "change_30d_pct", "change_1d_pct"]}}
        for r in sells
    ]

    return {"buy": buy_result, "sell": sell_result}


@app.get("/stocks/{ticker}")
async def stock_detail(ticker: str, period: str = "30d"):
    """종목 상세: 주가 차트 + 뉴스 + AI 분석"""
    ticker = ticker.upper()
    data_task = _run(get_stock_data, ticker, period)
    news_task = _run(fetch_stock_news, ticker)
    data, news = await asyncio.gather(data_task, news_task)

    if "error" in data:
        raise HTTPException(status_code=404, detail="종목 데이터를 가져올 수 없습니다")

    news_titles = [n["title"] for n in news if n.get("title")]
    insight = await _run(
        generate_stock_insight,
        ticker, data.get("name", ticker),
        data.get("change_30d_pct", 0), news_titles,
    )

    return {**data, "news": news, "insight": insight}


# ─────────────────────────────────────────────
# 코인
# ─────────────────────────────────────────────

@app.get("/crypto")
async def crypto_markets():
    """코인 시장 데이터 + 최신 뉴스"""
    coins_task = _run(get_coin_markets)
    news_task = _run(fetch_crypto_news)
    coins, news = await asyncio.gather(coins_task, news_task)
    return {"coins": coins, "news": news}


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
    """광물/원자재 시장 데이터 + 뉴스"""
    commodities_task = get_all_commodities()
    news_task = _run(fetch_commodity_news)
    data, news = await asyncio.gather(commodities_task, news_task)
    return {"commodities": data, "news": news}


# ─────────────────────────────────────────────
# 부동산
# ─────────────────────────────────────────────

@app.get("/realestate")
async def realestate():
    """한국 부동산 뉴스 + 주요 지표"""
    news = await _run(fetch_realestate_news)

    # 한국 주요 부동산 지표 (공개 API 미제공 → 참고용 고정값, 업데이트 필요 시 수동 갱신)
    indicators = [
        {"label": "서울 아파트 매매가격지수", "value": "105.2", "change": "+0.3%", "unit": "2021.01=100", "trend": "up"},
        {"label": "전국 아파트 전세가율", "value": "58.4%", "change": "-0.8%", "unit": "전세/매매", "trend": "down"},
        {"label": "서울 평균 아파트 매매가", "value": "12.4억", "change": "+1.2%", "unit": "원", "trend": "up"},
        {"label": "주택담보대출 금리", "value": "3.92%", "change": "-0.1%", "unit": "연(변동)", "trend": "down"},
        {"label": "미분양 주택 (전국)", "value": "7.2만 호", "change": "+2.1%", "unit": "호수", "trend": "up"},
        {"label": "서울 아파트 거래량", "value": "3,840건", "change": "+8.5%", "unit": "월간", "trend": "up"},
    ]

    return {"indicators": indicators, "news": news}


# ─────────────────────────────────────────────
# 돈의 흐름 (Money Flow)
# ─────────────────────────────────────────────

@app.get("/money-flow")
async def money_flow():
    """금리·자산군별 수익률 — 돈의 흐름 파악"""
    cached = await asyncio.get_event_loop().run_in_executor(_executor, db_get, "money_flow", 3600)
    if cached:
        return cached

    # 금리 민감 자산 지표 (^TNX=10년 국채, ^IRX=3개월)
    macro_tickers = ["^TNX", "^IRX", "GLD", "SPY", "TLT"]
    prices = await get_multiple_stocks_parallel(macro_tickers)
    coins = await _run(get_coin_markets)

    tnx = prices.get("^TNX", {})
    spy = prices.get("SPY", {})
    gld = prices.get("GLD", {})
    tlt = prices.get("TLT", {})
    btc = next((c for c in coins if c["symbol"] == "BTC"), {})
    eth = next((c for c in coins if c["symbol"] == "ETH"), {})

    assets = [
        {
            "category": "금리",
            "name": "미 10년 국채 금리",
            "value": f"{tnx.get('current_price', 4.3):.2f}%",
            "change_30d": tnx.get("change_30d_pct"),
            "description": "금리↑ → 채권·예금 매력↑, 주식·코인·부동산↓",
            "color": "#6366f1",
            "icon": "TNX",
        },
        {
            "category": "주식",
            "name": "S&P 500 (SPY)",
            "value": f"${spy.get('current_price', 0):,.0f}",
            "change_30d": spy.get("change_30d_pct"),
            "description": "금리↓ 수혜, 기업 실적·AI 성장 모멘텀",
            "color": "#10b981",
            "icon": "SPY",
        },
        {
            "category": "채권",
            "name": "장기채 (TLT)",
            "value": f"${tlt.get('current_price', 0):,.0f}",
            "change_30d": tlt.get("change_30d_pct"),
            "description": "금리↓ 시 가격 상승. 경기침체 헤지 수단.",
            "color": "#3b82f6",
            "icon": "TLT",
        },
        {
            "category": "금",
            "name": "금 (GLD ETF)",
            "value": f"${gld.get('current_price', 0):,.0f}",
            "change_30d": gld.get("change_30d_pct"),
            "description": "인플레이션·지정학 리스크 헤지. 달러 약세 수혜.",
            "color": "#f59e0b",
            "icon": "GLD",
        },
        {
            "category": "코인",
            "name": "Bitcoin (BTC)",
            "value": f"${btc.get('current_price', 0):,.0f}" if btc else "-",
            "change_30d": btc.get("price_change_30d") if btc else None,
            "description": "위험 선호 자산. 금리 인하·유동성 확장 시 강세.",
            "color": "#f97316",
            "icon": "BTC",
        },
        {
            "category": "부동산",
            "name": "서울 아파트",
            "value": "12.4억",
            "change_30d": 1.2,
            "description": "저금리·유동성 환경에서 강세. 고금리 시 조정.",
            "color": "#ec4899",
            "icon": "APT",
        },
    ]

    # 현재 금리 수준 기반 추천 메시지
    rate = tnx.get("current_price", 4.3) if tnx else 4.3
    if rate > 4.5:
        signal = {"level": "high", "message": "고금리 구간: 현금·채권 비중 확대 유리. 부동산·코인 비중 축소 고려."}
    elif rate > 3.5:
        signal = {"level": "mid", "message": "중립 금리 구간: 우량 주식·금 분산 투자 적합. 섹터 선별 중요."}
    else:
        signal = {"level": "low", "message": "저금리 구간: 성장주·코인·부동산 강세 환경. 리스크 자산 비중 확대 고려."}

    kor = await asyncio.get_event_loop().run_in_executor(_executor, get_korea_rates)
    fed_rate = await asyncio.get_event_loop().run_in_executor(_executor, get_fed_rate)
    result = {"assets": assets, "rate_signal": signal, "fed_rate": fed_rate, "korea_rates": kor}
    await asyncio.get_event_loop().run_in_executor(_executor, db_set, "money_flow", result)
    return result


# ─────────────────────────────────────────────
# 채권 (Bonds)
# ─────────────────────────────────────────────

@app.get("/bonds")
async def bonds():
    """채권 시장 데이터 (TLT, 10Y/3M 국채 금리) + 뉴스"""
    bond_tickers = ["^TNX", "^IRX", "TLT"]
    prices_task = get_multiple_stocks_parallel(bond_tickers)
    news_task = _run(fetch_bond_news)
    prices, news = await asyncio.gather(prices_task, news_task)

    tnx = prices.get("^TNX", {})
    irx = prices.get("^IRX", {})
    tlt = prices.get("TLT", {})
    fed_rate = await asyncio.get_event_loop().run_in_executor(_executor, get_fed_rate)

    data = {
        "fed_rate": fed_rate,
        "yield_10y": tnx.get("current_price"),
        "yield_10y_change": tnx.get("change_30d_pct"),
        "yield_3m": irx.get("current_price"),
        "yield_3m_change": irx.get("change_30d_pct"),
        "tlt_price": tlt.get("current_price"),
        "tlt_change_30d": tlt.get("change_30d_pct"),
        "tlt_change_1d": tlt.get("change_1d_pct"),
        "curve_inverted": (
            (tnx.get("current_price") or 0) < (irx.get("current_price") or 0)
        ),
    }
    return {"data": data, "news": news}


# ─────────────────────────────────────────────
# 오늘의 마켓 드라이버
# ─────────────────────────────────────────────

@app.get("/market-driver")
async def market_driver():
    """글로벌 헤드라인 → Gemini가 오늘 시장을 움직이는 핵심 뉴스 3개 선정"""
    headlines = await _run(fetch_top_headlines, 20)
    result = await _run(generate_market_drivers, headlines)
    return result


# ─────────────────────────────────────────────
# AI 뉴스 분석
# ─────────────────────────────────────────────

@app.get("/news-ai")
async def news_ai():
    """전 자산군 뉴스 수집 → Gemini 2.5 Flash 종합 분석"""
    news_by_category = await _run(fetch_market_news_all)
    result = await _run(generate_news_analysis, news_by_category)
    return result


# ─────────────────────────────────────────────
# 한국 금리 (Korea Rates)
# ─────────────────────────────────────────────

@app.get("/korea-rates")
async def korea_rates():
    """한국은행 ECOS API — 기준금리, 국고채 3년물, CD 91일물"""
    data = await asyncio.get_event_loop().run_in_executor(_executor, get_korea_rates)
    return data


# ─────────────────────────────────────────────
# 고래 신호 (Whale Signal)
# ─────────────────────────────────────────────

@app.get("/whale-signal")
async def whale_signal():
    """현재 시장 상황 종합 분석 — 거대한 돈이 어디로 이동하는가"""
    macro_tickers = ["^TNX", "^IRX", "GLD", "SPY", "TLT"]
    prices = await get_multiple_stocks_parallel(macro_tickers)
    coins = await _run(get_coin_markets)

    tnx = prices.get("^TNX", {})
    spy = prices.get("SPY", {})
    gld = prices.get("GLD", {})
    tlt = prices.get("TLT", {})
    btc = next((c for c in coins if c["symbol"] == "BTC"), {})

    assets = [
        {
            "category": "주식",
            "name": "S&P 500 (SPY)",
            "change_30d": spy.get("change_30d_pct"),
        },
        {
            "category": "채권",
            "name": "장기채 (TLT)",
            "change_30d": tlt.get("change_30d_pct"),
        },
        {
            "category": "금",
            "name": "금 (GLD ETF)",
            "change_30d": gld.get("change_30d_pct"),
        },
        {
            "category": "코인",
            "name": "Bitcoin (BTC)",
            "change_30d": btc.get("price_change_30d") if btc else None,
        },
        {
            "category": "부동산",
            "name": "서울 아파트",
            "change_30d": 1.2,
        },
    ]

    fed_rate = await asyncio.get_event_loop().run_in_executor(_executor, get_fed_rate)
    signal, market_news, asia_news = await asyncio.gather(
        get_whale_signal(assets, fed_rate),
        _run(fetch_stock_market_news, 6),
        _run(fetch_asia_market_news, 4),
    )
    return {**signal, "market_news": market_news, "asia_news": asia_news}


# ─────────────────────────────────────────────
# 오늘의 투자포인트
# ─────────────────────────────────────────────

@app.get("/today-picks")
async def today_picks():
    """S&P 500 대표 50종목 AI 분석 — 매수 3 / 매도 3 / 관심 3"""
    return await _run(get_today_picks)

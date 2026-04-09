"""
백그라운드 스케줄러 — DB-Only 아키텍처

엔드포인트: Supabase에서만 읽음 (< 200ms, 항상 즉시 응답)
스케줄러:  외부 API / Gemini / FinBERT 호출 전담 → Supabase에 저장

Gemini 호출 원칙:
  - 엔드포인트에서는 절대 Gemini 호출 없음
  - warm_all_caches()에서도 Gemini 호출 없음
  - 오직 스케줄러 잡에서만 호출 (주기적, 4초 간격 자동 적용)

잡 주기:
  - investors / stocks_hot / recommendations: 10분 (Yahoo Finance만)
  - investor_details: 1시간 (Yahoo Finance + Gemini × 8명)
  - hot_stock_details: 1시간 (Yahoo Finance + Gemini × 12종목)
  - market_driver (Gemini): 30분
  - today_picks (FinBERT + Gemini): 6시간
"""
import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)


async def _run_sync(fn, *args):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, fn, *args)


async def refresh_investors():
    from backend.services.investors import get_all_investors
    from backend.services.financial import get_multiple_stocks_parallel
    from backend.services.db_cache import db_set
    try:
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
        await _run_sync(db_set, "investors_list", {"investors": result})
        logger.info("✅ [scheduler] investors_list 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] investors_list 갱신 실패: {e}")


async def refresh_stocks_hot():
    from backend.services.investors import get_hot_tickers
    from backend.services.financial import get_multiple_stocks_parallel
    from backend.services.db_cache import db_set
    try:
        tickers = get_hot_tickers()
        stocks = await get_multiple_stocks_parallel(tickers)
        result = [data for ticker in tickers if "error" not in (data := stocks.get(ticker, {}))]
        await _run_sync(db_set, "stocks_hot", {"stocks": result})
        logger.info("✅ [scheduler] stocks_hot 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] stocks_hot 갱신 실패: {e}")


async def refresh_recommendations():
    from backend.services.investors import get_buy_recommendations, get_sell_recommendations
    from backend.services.financial import get_multiple_stocks_parallel
    from backend.services.db_cache import db_set
    try:
        buys = get_buy_recommendations()
        sells = get_sell_recommendations()
        all_tickers = list(set([r["ticker"] for r in buys] + [r["ticker"] for r in sells]))
        prices = await get_multiple_stocks_parallel(all_tickers)
        buy_result = [
            {**r, **{k: prices.get(r["ticker"], {}).get(k) for k in ["current_price", "change_30d_pct", "change_1d_pct"]}}
            for r in buys
        ]
        sell_result = [
            {**r, **{k: prices.get(r["ticker"], {}).get(k) for k in ["current_price", "change_30d_pct", "change_1d_pct"]}}
            for r in sells
        ]
        await _run_sync(db_set, "stocks_recommendations", {"buy": buy_result, "sell": sell_result})
        logger.info("✅ [scheduler] stocks_recommendations 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] stocks_recommendations 갱신 실패: {e}")


async def refresh_investor_details():
    """투자자 8명 상세 + Gemini 인사이트 갱신 (1시간 주기)
    순차 실행 — gemini.py의 4초 간격 보장으로 레이트 리밋 안전"""
    from backend.services.investors import get_all_investors
    from backend.services.financial import get_multiple_stocks_parallel
    from backend.services.news import fetch_investor_news
    from backend.services.ai_summary import generate_investor_insight
    from backend.services.db_cache import db_set

    investors = get_all_investors()
    for inv in investors:
        investor_id = inv["id"]
        try:
            tickers = [p["ticker"] for p in inv["portfolio"]]
            prices_task = get_multiple_stocks_parallel(tickers)
            news_task = _run_sync(fetch_investor_news, inv["name"])
            prices, news = await asyncio.gather(prices_task, news_task)

            news_titles = [n["title"] for n in news if n.get("title")]
            insight = await _run_sync(
                generate_investor_insight,
                inv["name"], inv["firm"], inv["recent_moves"], news_titles,
            )
            portfolio_with_prices = [
                {
                    **holding,
                    "current_price": prices.get(holding["ticker"], {}).get("current_price"),
                    "change_30d_pct": prices.get(holding["ticker"], {}).get("change_30d_pct"),
                    "change_1d_pct": prices.get(holding["ticker"], {}).get("change_1d_pct"),
                    "sector": prices.get(holding["ticker"], {}).get("sector", ""),
                }
                for holding in inv["portfolio"]
            ]
            result = {**inv, "portfolio": portfolio_with_prices, "news": news, "insight": insight}
            await _run_sync(db_set, f"investor_detail_{investor_id}", result)
            logger.info(f"✅ [scheduler] investor_detail_{investor_id} 갱신 완료")
        except Exception as e:
            logger.error(f"❌ [scheduler] investor_detail_{investor_id} 갱신 실패: {e}")


async def refresh_hot_stock_details():
    """핫 종목 12개 상세 + Gemini 인사이트 갱신 (1시간 주기)
    순차 실행 — gemini.py의 4초 간격 보장으로 레이트 리밋 안전"""
    from backend.services.investors import get_hot_tickers
    from backend.services.financial import get_stock_data
    from backend.services.news import fetch_stock_news
    from backend.services.ai_summary import generate_stock_insight
    from backend.services.db_cache import db_set

    tickers = get_hot_tickers()
    for ticker in tickers:
        try:
            data_task = _run_sync(get_stock_data, ticker, "30d")
            news_task = _run_sync(fetch_stock_news, ticker)
            data, news = await asyncio.gather(data_task, news_task)

            if "error" in data:
                continue

            news_titles = [n["title"] for n in news if n.get("title")]
            insight = await _run_sync(
                generate_stock_insight,
                ticker, data.get("name", ticker),
                data.get("change_30d_pct", 0), news_titles,
            )
            result = {**data, "news": news, "insight": insight}
            await _run_sync(db_set, f"stock_detail_{ticker}_30d", result)
            logger.info(f"✅ [scheduler] stock_detail_{ticker} 갱신 완료")
        except Exception as e:
            logger.error(f"❌ [scheduler] stock_detail_{ticker} 갱신 실패: {e}")


async def refresh_crypto():
    """코인 시세 + 뉴스 갱신 (10분 주기, Gemini 없음)"""
    from backend.services.coins import get_coin_markets
    from backend.services.news import fetch_crypto_news
    from backend.services.db_cache import db_set
    try:
        coins_task = get_coin_markets()
        news_task = _run_sync(fetch_crypto_news)
        coins, news = await asyncio.gather(coins_task, news_task)
        await _run_sync(db_set, "crypto", {"coins": coins, "news": news})
        logger.info("✅ [scheduler] crypto 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] crypto 갱신 실패: {e}")


async def refresh_commodities():
    """광물/원자재 시세 + 뉴스 갱신 (30분 주기, Gemini 없음)"""
    from backend.services.commodities import get_all_commodities
    from backend.services.news import fetch_commodity_news
    from backend.services.db_cache import db_set
    try:
        data_task = get_all_commodities()
        news_task = _run_sync(fetch_commodity_news)
        data, news = await asyncio.gather(data_task, news_task)
        await _run_sync(db_set, "commodities", {"commodities": data, "news": news})
        logger.info("✅ [scheduler] commodities 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] commodities 갱신 실패: {e}")


async def refresh_bonds():
    """채권 시장 데이터 + 뉴스 갱신 (30분 주기, Gemini 없음)"""
    from backend.services.financial import get_multiple_stocks_parallel
    from backend.services.news import fetch_bond_news
    from backend.services.fed_rate import get_fed_rate
    from backend.services.db_cache import db_set
    try:
        prices_task = get_multiple_stocks_parallel(["^TNX", "^IRX", "TLT"])
        news_task = _run_sync(fetch_bond_news)
        prices, news = await asyncio.gather(prices_task, news_task)
        fed_rate = await _run_sync(get_fed_rate)
        tnx = prices.get("^TNX", {})
        irx = prices.get("^IRX", {})
        tlt = prices.get("TLT", {})
        result = {
            "data": {
                "fed_rate": fed_rate,
                "yield_10y": tnx.get("current_price"),
                "yield_10y_change": tnx.get("change_30d_pct"),
                "yield_3m": irx.get("current_price"),
                "yield_3m_change": irx.get("change_30d_pct"),
                "tlt_price": tlt.get("current_price"),
                "tlt_change_30d": tlt.get("change_30d_pct"),
                "tlt_change_1d": tlt.get("change_1d_pct"),
                "curve_inverted": (tnx.get("current_price") or 0) < (irx.get("current_price") or 0),
            },
            "news": news,
        }
        await _run_sync(db_set, "bonds", result)
        logger.info("✅ [scheduler] bonds 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] bonds 갱신 실패: {e}")


async def refresh_korea_rates():
    """한국은행 금리 데이터 갱신 (1시간 주기, Gemini 없음)"""
    from backend.services.korea_rates import get_korea_rates
    from backend.services.db_cache import db_set
    try:
        data = await _run_sync(get_korea_rates)
        await _run_sync(db_set, "korea_rates", data)
        logger.info("✅ [scheduler] korea_rates 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] korea_rates 갱신 실패: {e}")


async def refresh_realestate():
    """부동산 뉴스 갱신 (1시간 주기, Gemini 없음)"""
    from backend.services.news import fetch_realestate_news
    from backend.services.db_cache import db_set
    try:
        news = await _run_sync(fetch_realestate_news)
        indicators = [
            {"label": "서울 아파트 매매가격지수", "value": "105.2", "change": "+0.3%", "unit": "2021.01=100", "trend": "up"},
            {"label": "전국 아파트 전세가율", "value": "58.4%", "change": "-0.8%", "unit": "전세/매매", "trend": "down"},
            {"label": "서울 평균 아파트 매매가", "value": "12.4억", "change": "+1.2%", "unit": "원", "trend": "up"},
            {"label": "주택담보대출 금리", "value": "3.92%", "change": "-0.1%", "unit": "연(변동)", "trend": "down"},
            {"label": "미분양 주택 (전국)", "value": "7.2만 호", "change": "+2.1%", "unit": "호수", "trend": "up"},
            {"label": "서울 아파트 거래량", "value": "3,840건", "change": "+8.5%", "unit": "월간", "trend": "up"},
        ]
        await _run_sync(db_set, "realestate", {"indicators": indicators, "news": news})
        logger.info("✅ [scheduler] realestate 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] realestate 갱신 실패: {e}")


async def refresh_money_flow():
    """돈의 흐름 데이터 갱신 (30분 주기, Gemini 없음)"""
    from backend.services.financial import get_multiple_stocks_parallel
    from backend.services.coins import get_coin_markets
    from backend.services.korea_rates import get_korea_rates
    from backend.services.fed_rate import get_fed_rate
    from backend.services.db_cache import db_set
    try:
        prices_task = get_multiple_stocks_parallel(["^TNX", "^IRX", "GLD", "SPY", "TLT"])
        coins_task = get_coin_markets()
        prices, coins = await asyncio.gather(prices_task, coins_task)
        tnx = prices.get("^TNX", {})
        spy = prices.get("SPY", {})
        gld = prices.get("GLD", {})
        tlt = prices.get("TLT", {})
        btc = next((c for c in coins if c["symbol"] == "BTC"), {})
        assets = [
            {"category": "금리", "name": "미 10년 국채 금리",
             "value": f"{tnx.get('current_price', 4.3):.2f}%",
             "change_30d": tnx.get("change_30d_pct"),
             "description": "금리↑ → 채권·예금 매력↑, 주식·코인·부동산↓",
             "color": "#6366f1", "icon": "TNX"},
            {"category": "주식", "name": "S&P 500 (SPY)",
             "value": f"${spy.get('current_price', 0):,.0f}",
             "change_30d": spy.get("change_30d_pct"),
             "description": "금리↓ 수혜, 기업 실적·AI 성장 모멘텀",
             "color": "#10b981", "icon": "SPY"},
            {"category": "채권", "name": "장기채 (TLT)",
             "value": f"${tlt.get('current_price', 0):,.0f}",
             "change_30d": tlt.get("change_30d_pct"),
             "description": "금리↓ 시 가격 상승. 경기침체 헤지 수단.",
             "color": "#3b82f6", "icon": "TLT"},
            {"category": "금", "name": "금 (GLD ETF)",
             "value": f"${gld.get('current_price', 0):,.0f}",
             "change_30d": gld.get("change_30d_pct"),
             "description": "인플레이션·지정학 리스크 헤지. 달러 약세 수혜.",
             "color": "#f59e0b", "icon": "GLD"},
            {"category": "코인", "name": "Bitcoin (BTC)",
             "value": f"${btc.get('current_price', 0):,.0f}" if btc else "-",
             "change_30d": btc.get("price_change_30d") if btc else None,
             "description": "위험 선호 자산. 금리 인하·유동성 확장 시 강세.",
             "color": "#f97316", "icon": "BTC"},
            {"category": "부동산", "name": "서울 아파트",
             "value": "12.4억", "change_30d": 1.2,
             "description": "저금리·유동성 환경에서 강세. 고금리 시 조정.",
             "color": "#ec4899", "icon": "APT"},
        ]
        rate = tnx.get("current_price", 4.3) or 4.3
        if rate > 4.5:
            signal = {"level": "high", "message": "고금리 구간: 현금·채권 비중 확대 유리. 부동산·코인 비중 축소 고려."}
        elif rate > 3.5:
            signal = {"level": "mid", "message": "중립 금리 구간: 우량 주식·금 분산 투자 적합. 섹터 선별 중요."}
        else:
            signal = {"level": "low", "message": "저금리 구간: 성장주·코인·부동산 강세 환경. 리스크 자산 비중 확대 고려."}
        kor = await _run_sync(get_korea_rates)
        fed_rate = await _run_sync(get_fed_rate)
        result = {"assets": assets, "rate_signal": signal, "fed_rate": fed_rate, "korea_rates": kor}
        await _run_sync(db_set, "money_flow", result)
        logger.info("✅ [scheduler] money_flow 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] money_flow 갱신 실패: {e}")


async def refresh_whale_signal():
    """고래 신호 갱신 (6시간 주기, Gemini 포함)"""
    from backend.services.financial import get_multiple_stocks_parallel
    from backend.services.coins import get_coin_markets
    from backend.services.fed_rate import get_fed_rate
    from backend.services.whale_signal import get_whale_signal
    from backend.services.news import fetch_stock_market_news, fetch_asia_market_news
    from backend.services.db_cache import db_set
    try:
        prices_task = get_multiple_stocks_parallel(["^TNX", "^IRX", "GLD", "SPY", "TLT"])
        coins_task = get_coin_markets()
        prices, coins = await asyncio.gather(prices_task, coins_task)
        spy = prices.get("SPY", {})
        tlt = prices.get("TLT", {})
        gld = prices.get("GLD", {})
        btc = next((c for c in coins if c["symbol"] == "BTC"), {})
        assets = [
            {"category": "주식", "name": "S&P 500 (SPY)", "change_30d": spy.get("change_30d_pct")},
            {"category": "채권", "name": "장기채 (TLT)", "change_30d": tlt.get("change_30d_pct")},
            {"category": "금", "name": "금 (GLD ETF)", "change_30d": gld.get("change_30d_pct")},
            {"category": "코인", "name": "Bitcoin (BTC)", "change_30d": btc.get("price_change_30d") if btc else None},
            {"category": "부동산", "name": "서울 아파트", "change_30d": 1.2},
        ]
        fed_rate = await _run_sync(get_fed_rate)
        signal, market_news, asia_news = await asyncio.gather(
            get_whale_signal(assets, fed_rate),
            _run_sync(fetch_stock_market_news, 6),
            _run_sync(fetch_asia_market_news, 4),
        )
        result = {**signal, "market_news": market_news, "asia_news": asia_news}
        await _run_sync(db_set, "whale_signal_full", result)
        logger.info("✅ [scheduler] whale_signal 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] whale_signal 갱신 실패: {e}")


async def refresh_news_ai():
    """전 자산군 뉴스 AI 분석 갱신 (1시간 주기, Gemini 포함)"""
    from backend.services.news import fetch_market_news_all
    from backend.services.ai_summary import generate_news_analysis
    from backend.services.db_cache import db_set
    try:
        news_by_category = await _run_sync(fetch_market_news_all)
        result = await _run_sync(generate_news_analysis, news_by_category)
        await _run_sync(db_set, "news_ai", result)
        logger.info("✅ [scheduler] news_ai 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] news_ai 갱신 실패: {e}")


async def refresh_market_driver():
    """오늘의 마켓 드라이버 (Gemini) → Supabase 갱신"""
    from backend.services.news import fetch_top_headlines
    from backend.services.ai_summary import generate_market_drivers
    try:
        headlines = await _run_sync(fetch_top_headlines, 20)
        await _run_sync(generate_market_drivers, headlines)
        logger.info("✅ [scheduler] market_driver 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] market_driver 갱신 실패: {e}")


async def refresh_today_picks():
    """S&P 50종목 FinBERT + Gemini 분석 → Supabase 갱신"""
    from backend.services.today_picks import get_today_picks
    try:
        await _run_sync(get_today_picks)
        logger.info("✅ [scheduler] today_picks 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] today_picks 갱신 실패: {e}")


async def warm_all_caches():
    """앱 시작 시 캐시 웜업 — Gemini 없는 데이터 전부 즉시 갱신
    Gemini 잡(whale_signal·news_ai·investor_details·hot_stock_details·market_driver·today_picks)은
    스케줄러가 주기적으로 채움"""
    logger.info("🔥 [scheduler] 캐시 웜업 시작 (Gemini 없음)...")
    await asyncio.gather(
        refresh_investors(),
        refresh_stocks_hot(),
        refresh_recommendations(),
        refresh_crypto(),
        refresh_commodities(),
        refresh_bonds(),
        refresh_korea_rates(),
        refresh_realestate(),
        refresh_money_flow(),
        return_exceptions=True,
    )
    logger.info("🔥 [scheduler] 캐시 웜업 완료")


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")
    # ── Gemini 없음 (빠른 주기) ─────────────────────────────
    scheduler.add_job(refresh_investors,     "interval", minutes=10, id="investors",     max_instances=1)
    scheduler.add_job(refresh_stocks_hot,    "interval", minutes=10, id="stocks_hot",    max_instances=1)
    scheduler.add_job(refresh_recommendations,"interval", minutes=10, id="recommendations",max_instances=1)
    scheduler.add_job(refresh_crypto,        "interval", minutes=10, id="crypto",        max_instances=1)
    scheduler.add_job(refresh_commodities,   "interval", minutes=30, id="commodities",   max_instances=1)
    scheduler.add_job(refresh_bonds,         "interval", minutes=30, id="bonds",         max_instances=1)
    scheduler.add_job(refresh_money_flow,    "interval", minutes=30, id="money_flow",    max_instances=1)
    scheduler.add_job(refresh_korea_rates,   "interval", hours=1,    id="korea_rates",   max_instances=1)
    scheduler.add_job(refresh_realestate,    "interval", hours=1,    id="realestate",    max_instances=1)
    # ── Gemini 포함 (긴 주기, 4초 간격 자동 적용) ───────────
    scheduler.add_job(refresh_investor_details,  "interval", hours=1,  id="investor_details",  max_instances=1)
    scheduler.add_job(refresh_hot_stock_details, "interval", hours=1,  id="hot_stock_details", max_instances=1)
    scheduler.add_job(refresh_news_ai,           "interval", hours=1,  id="news_ai",           max_instances=1)
    scheduler.add_job(refresh_market_driver,     "interval", minutes=30, id="market_driver",   max_instances=1)
    scheduler.add_job(refresh_whale_signal,      "interval", hours=6,  id="whale_signal",      max_instances=1)
    scheduler.add_job(refresh_today_picks,       "interval", hours=6,  id="today_picks",       max_instances=1)
    return scheduler

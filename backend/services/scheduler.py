"""
백그라운드 스케줄러 — DB-Only 아키텍처

엔드포인트: Supabase에서만 읽음 (< 200ms, 항상 즉시 응답)
스케줄러:  외부 API / Gemini / FinBERT 호출 전담 → Supabase에 저장

잡 주기:
  - investors / stocks_hot / recommendations: 10분
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
    """앱 시작 시 캐시 웜업 — 주가(즉시) + AI 분석(백그라운드, 30~90초 소요)"""
    logger.info("🔥 [scheduler] 캐시 웜업 시작...")
    # 주가 데이터는 빠름 (~10초), AI 분석은 느리지만 백그라운드 실행이라 서버 응답에 영향 없음
    await asyncio.gather(
        refresh_investors(),
        refresh_stocks_hot(),
        refresh_recommendations(),
        refresh_market_driver(),   # 30~35초 (Gemini) — 백그라운드에서 실행됨
        return_exceptions=True,
    )
    logger.info("🔥 [scheduler] 캐시 웜업 완료")


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(refresh_investors, "interval", minutes=10, id="investors", max_instances=1)
    scheduler.add_job(refresh_stocks_hot, "interval", minutes=10, id="stocks_hot", max_instances=1)
    scheduler.add_job(refresh_recommendations, "interval", minutes=10, id="recommendations", max_instances=1)
    scheduler.add_job(refresh_market_driver, "interval", minutes=30, id="market_driver", max_instances=1)
    scheduler.add_job(refresh_today_picks, "interval", hours=6, id="today_picks", max_instances=1)
    return scheduler

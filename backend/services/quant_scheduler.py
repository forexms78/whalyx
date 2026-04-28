"""
자동매매 스케줄러 — 이동평균선(MA5/MA20) 골든크로스 + PER 필터

신호 로직:
  매수: MA5가 MA20을 상향 돌파(골든크로스) AND PER < PER_MAX_BUY
  매도(익절): MA5가 MA20을 하향 돌파(데드크로스)
  매도(손절): 보유 종목이 STOP_LOSS_PCT 이하 수익률
"""
from datetime import datetime

from backend.services.db_cache import _get_client as _sb
from backend.services.kis_trader import (
    get_price_and_fundamentals,
    get_daily_prices,
    get_holdings,
    buy_market_order,
    sell_market_order,
    calculate_quantity,
)

MAX_AMOUNT_PER_STOCK = 500_000
STOP_LOSS_PCT = -8.0
PER_MAX_BUY = 20.0      # PER이 이 값 이하인 종목만 매수
MA_SHORT = 5
MA_LONG = 20

# 기본 유니버스 — KOSPI 대형주 (시스템 자동 관리)
DEFAULT_UNIVERSE = [
    {"ticker": "005930", "name": "삼성전자"},
    {"ticker": "000660", "name": "SK하이닉스"},
    {"ticker": "035420", "name": "NAVER"},
    {"ticker": "051910", "name": "LG화학"},
    {"ticker": "006400", "name": "삼성SDI"},
    {"ticker": "035720", "name": "카카오"},
    {"ticker": "207940", "name": "삼성바이오로직스"},
    {"ticker": "068270", "name": "셀트리온"},
    {"ticker": "105560", "name": "KB금융"},
    {"ticker": "055550", "name": "신한지주"},
    {"ticker": "086790", "name": "하나금융지주"},
    {"ticker": "032830", "name": "삼성생명"},
    {"ticker": "003550", "name": "LG"},
    {"ticker": "012330", "name": "현대모비스"},
    {"ticker": "005380", "name": "현대차"},
    {"ticker": "000270", "name": "기아"},
    {"ticker": "034730", "name": "SK"},
    {"ticker": "096770", "name": "SK이노베이션"},
    {"ticker": "028260", "name": "삼성물산"},
    {"ticker": "066570", "name": "LG전자"},
]


def _ensure_universe():
    """유니버스 테이블이 비어있으면 기본 종목 시딩"""
    existing = _sb().table("autotrade_watchlist").select("ticker").execute().data or []
    existing_tickers = {r["ticker"] for r in existing}
    to_insert = [s for s in DEFAULT_UNIVERSE if s["ticker"] not in existing_tickers]
    if to_insert:
        _sb().table("autotrade_watchlist").insert(to_insert).execute()


def _ma(prices: list[float], n: int) -> float | None:
    if len(prices) < n:
        return None
    return sum(prices[:n]) / n


def _calc_signal(ticker: str) -> dict:
    """이동평균선 골든크로스 + PER 필터로 매수/매도 신호 계산"""
    try:
        info = get_price_and_fundamentals(ticker)
        prices = get_daily_prices(ticker, days=MA_LONG + 5)
    except Exception as e:
        return {"signal": "hold", "reason": str(e), "current_price": None}

    cp = info["current_price"]
    per = info["per"]

    ma5_now = _ma(prices, MA_SHORT)
    ma20_now = _ma(prices, MA_LONG)
    ma5_prev = _ma(prices[1:], MA_SHORT)
    ma20_prev = _ma(prices[1:], MA_LONG)

    if not all([cp, ma5_now, ma20_now, ma5_prev, ma20_prev]):
        return {"signal": "hold", "reason": "데이터 부족", "current_price": cp, **info}

    golden_cross = ma5_prev <= ma20_prev and ma5_now > ma20_now
    dead_cross = ma5_prev >= ma20_prev and ma5_now < ma20_now

    if golden_cross and (per is None or per < PER_MAX_BUY):
        signal = "buy"
        reason = f"골든크로스 (MA{MA_SHORT}>{MA_LONG}) PER={per}"
    elif dead_cross:
        signal = "sell"
        reason = f"데드크로스 (MA{MA_SHORT}<MA{MA_LONG})"
    else:
        signal = "hold"
        reason = f"MA{MA_SHORT}={ma5_now:.0f} MA{MA_LONG}={ma20_now:.0f}"

    return {
        "signal": signal,
        "reason": reason,
        "current_price": cp,
        "ma5": round(ma5_now, 0),
        "ma20": round(ma20_now, 0),
        "per": per,
        "pbr": info.get("pbr"),
        "w52_high": info.get("w52_high"),
        "w52_low": info.get("w52_low"),
    }


def _notify(action: str, ticker: str, price: float, quantity: int, reason: str):
    action_str = "매수" if action == "buy" else "매도"
    msg = f"[자동매매] {action_str} · {ticker}\n{price:,.0f}원 x {quantity}주\n{reason}"
    try:
        from backend.services.telegram_notifier import send_telegram_message
        send_telegram_message(msg)
    except Exception:
        pass


def _record_trade(ticker: str, action: str, price: float, quantity: int, reason: str, order_id: str = ""):
    _sb().table("auto_trades").insert({
        "ticker": ticker,
        "action": action,
        "price": price,
        "quantity": quantity,
        "amount": price * quantity,
        "reason": reason,
        "kis_order_id": order_id,
    }).execute()
    _notify(action, ticker, price, quantity, reason)


def _is_trading_hours() -> bool:
    now = datetime.now()
    if now.weekday() >= 5:
        return False
    h, m = now.hour, now.minute
    return (9, 0) <= (h, m) <= (15, 30)


def scan_and_trade():
    if not _is_trading_hours():
        return

    _ensure_universe()

    # 1. 보유 종목 손절 및 데드크로스 매도
    try:
        holdings = get_holdings()
        for h in holdings:
            sell_reason = None
            if h["pnl_pct"] <= STOP_LOSS_PCT:
                sell_reason = f"손절 ({h['pnl_pct']:.1f}%)"
            else:
                sig = _calc_signal(h["ticker"])
                if sig["signal"] == "sell":
                    sell_reason = sig["reason"]
            if sell_reason:
                result = sell_market_order(h["ticker"], h["quantity"])
                order_id = result.get("output", {}).get("ODNO", "")
                _record_trade(h["ticker"], "sell", h["current_price"], h["quantity"], sell_reason, order_id)
    except Exception as e:
        print(f"[quant_scheduler] 매도 스캔 오류: {e}")

    # 2. 유니버스 스캔 → 골든크로스 매수
    try:
        universe = _sb().table("autotrade_watchlist").select("ticker, name").execute().data or []
        holdings = get_holdings()
        held = {h["ticker"] for h in holdings}

        for stock in universe:
            ticker = stock["ticker"]
            if ticker in held:
                continue
            try:
                sig = _calc_signal(ticker)
                if sig["signal"] == "buy" and sig.get("current_price"):
                    qty = calculate_quantity(MAX_AMOUNT_PER_STOCK, sig["current_price"])
                    if qty > 0:
                        result = buy_market_order(ticker, qty)
                        order_id = result.get("output", {}).get("ODNO", "")
                        _record_trade(ticker, "buy", sig["current_price"], qty, sig["reason"], order_id)
            except Exception as e:
                print(f"[quant_scheduler] {ticker} 처리 오류: {e}")
    except Exception as e:
        print(f"[quant_scheduler] 매수 스캔 오류: {e}")


def get_universe_signals() -> list[dict]:
    """자동매매 대시보드용 — 유니버스 전체 시그널 스냅샷"""
    _ensure_universe()
    universe = _sb().table("autotrade_watchlist").select("ticker, name").execute().data or []
    results = []
    for stock in universe:
        try:
            sig = _calc_signal(stock["ticker"])
            results.append({
                "ticker": stock["ticker"],
                "name": stock["name"],
                **sig,
            })
        except Exception:
            results.append({"ticker": stock["ticker"], "name": stock["name"], "signal": "hold"})
    return results

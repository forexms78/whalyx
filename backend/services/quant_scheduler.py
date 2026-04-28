"""
자동매매 스케줄러 v2 — 멀티 필터 골든크로스 전략

[진입 조건 — 모두 충족 필요]
  1. MA5/MA20 골든크로스 (직전 완성 캔들 기준)
  2. RSI 40~60 (과매수/과매도 회피)
  3. EMA12 > EMA26 (MACD 방향성 확인)
  4. 거래량 ≥ 직전 5봉 평균 × 1.5

[청산 조건]
  손절:     진입가 대비 -5%
  트레일링: +5% 도달 후 진입가(본전) 하회 시 청산
  익절:     진입가 대비 +10%
  강제청산: 15:00 이후 모든 KR 포지션 청산

[리스크 필터]
  최대 동시 보유: 5종목
  동일 섹터:     2종목 이상 금지
  코스피:        당일 -1.5% 이상 하락 시 신규 진입 전면 중단
  일일 손실:     당일 실현 손익 -3% 초과 시 매매 종료
  뉴스 감성:     부정 뉴스 감지 시 진입 차단
  잔고:          주문 전 잔고 재확인, 부족 시 중단
"""
import json
from datetime import datetime, timedelta

from backend.services.db_cache import _get_client as _sb
from backend.services.kis_trader import (
    get_price_and_fundamentals,
    get_daily_data,
    get_us_price_and_fundamentals,
    get_vkospi,
    get_account_cash,
    get_holdings,
    buy_market_order,
    sell_market_order,
    calculate_quantity,
)

# ── 파라미터 ──────────────────────────────────────────
MAX_AMOUNT_PER_STOCK = 500_000        # 종목당 최대 투자금
STOP_LOSS_PCT        = -5.0           # 손절
TAKE_PROFIT_PCT      = 10.0           # 익절
TRAILING_TRIGGER_PCT = 5.0            # 트레일링 활성화 기준
FORCE_CLOSE_HOUR     = (15, 0)        # 강제 청산 시각
MAX_POSITIONS        = 5              # 최대 동시 보유 종목
MAX_SECTOR_POSITIONS = 2              # 동일 섹터 최대
KOSPI_HALT_PCT       = -1.5           # 코스피 하락 시 신규 진입 중단
DAILY_LOSS_LIMIT_PCT = -3.0           # 일일 손실 한도
VOLUME_MULT          = 1.5            # 거래량 배수
RSI_MIN, RSI_MAX     = 40, 60         # RSI 진입 범위
PER_MIN, PER_MAX     = 5.0, 30.0      # PER 범위
MA_SHORT, MA_LONG    = 5, 20
MA_TREND             = 60             # 장기 추세 확인용 MA (MTF 대체)
VKOSPI_HALVE         = 25.0           # VKOSPI 이상 시 포지션 절반
USE_FINANCIAL_FILTER = True           # 5단계 재무 필터 사용 여부

# ── 섹터 맵 ───────────────────────────────────────────
SECTOR_MAP: dict[str, str] = {
    "005930": "반도체", "000660": "반도체", "NVDA": "반도체", "AVGO": "반도체",
    "035420": "IT서비스", "035720": "IT서비스",
    "051910": "화학",    "006400": "화학",
    "207940": "바이오",  "068270": "바이오", "LLY": "바이오",
    "105560": "금융",    "055550": "금융",   "086790": "금융", "032830": "금융",
    "JPM": "금융",       "V": "금융",        "BRK-B": "금융",
    "005380": "자동차",  "000270": "자동차", "TSLA": "자동차",
    "066570": "전자",    "003550": "전자",
    "AAPL": "테크",  "MSFT": "테크", "GOOGL": "테크",
    "META": "테크",  "AMZN": "테크",
}

# ── 기본 유니버스 ─────────────────────────────────────
DEFAULT_UNIVERSE = [
    {"ticker": "005930", "name": "삼성전자",          "market": "KR"},
    {"ticker": "000660", "name": "SK하이닉스",         "market": "KR"},
    {"ticker": "035420", "name": "NAVER",              "market": "KR"},
    {"ticker": "051910", "name": "LG화학",             "market": "KR"},
    {"ticker": "006400", "name": "삼성SDI",            "market": "KR"},
    {"ticker": "035720", "name": "카카오",             "market": "KR"},
    {"ticker": "207940", "name": "삼성바이오로직스",    "market": "KR"},
    {"ticker": "068270", "name": "셀트리온",           "market": "KR"},
    {"ticker": "105560", "name": "KB금융",             "market": "KR"},
    {"ticker": "055550", "name": "신한지주",           "market": "KR"},
    {"ticker": "005380", "name": "현대차",             "market": "KR"},
    {"ticker": "000270", "name": "기아",               "market": "KR"},
    {"ticker": "066570", "name": "LG전자",             "market": "KR"},
    {"ticker": "AAPL",   "name": "Apple",              "market": "US"},
    {"ticker": "MSFT",   "name": "Microsoft",          "market": "US"},
    {"ticker": "NVDA",   "name": "NVIDIA",             "market": "US"},
    {"ticker": "GOOGL",  "name": "Alphabet",           "market": "US"},
    {"ticker": "AMZN",   "name": "Amazon",             "market": "US"},
    {"ticker": "META",   "name": "Meta",               "market": "US"},
    {"ticker": "TSLA",   "name": "Tesla",              "market": "US"},
    {"ticker": "AVGO",   "name": "Broadcom",           "market": "US"},
    {"ticker": "JPM",    "name": "JPMorgan Chase",     "market": "US"},
    {"ticker": "V",      "name": "Visa",               "market": "US"},
    {"ticker": "BRK-B",  "name": "Berkshire Hathaway", "market": "US"},
    {"ticker": "LLY",    "name": "Eli Lilly",          "market": "US"},
]

# 인메모리 트레일링 스톱 추적 (재시작 시 초기화)
_trailing_activated: set[str] = set()
# 뉴스 감성 캐시
_sentiment_cache: dict[str, dict] = {}


def _ensure_universe():
    existing = _sb().table("autotrade_watchlist").select("ticker").execute().data or []
    existing_tickers = {r["ticker"] for r in existing}
    to_insert = [s for s in DEFAULT_UNIVERSE if s["ticker"] not in existing_tickers]
    if to_insert:
        _sb().table("autotrade_watchlist").insert(to_insert).execute()


# ── 기술적 지표 ───────────────────────────────────────

def _ma(prices: list[float], n: int) -> float | None:
    if len(prices) < n:
        return None
    return sum(prices[:n]) / n


def _rsi(closes: list[float], period: int = 14) -> float | None:
    """RSI — closes: 최신순"""
    if len(closes) < period + 1:
        return None
    prices = list(reversed(closes[:period + 1]))
    gains, losses = [], []
    for i in range(1, len(prices)):
        d = prices[i] - prices[i - 1]
        gains.append(max(d, 0))
        losses.append(max(-d, 0))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0
    return round(100 - (100 / (1 + avg_gain / avg_loss)), 1)


def _ema(prices_asc: list[float], period: int) -> float | None:
    if len(prices_asc) < period:
        return None
    k = 2 / (period + 1)
    ema = sum(prices_asc[:period]) / period
    for p in prices_asc[period:]:
        ema = p * k + ema * (1 - k)
    return ema


def _macd_bullish(closes: list[float]) -> bool | None:
    """EMA12 > EMA26 여부 — closes: 최신순"""
    if len(closes) < 30:
        return None
    asc = list(reversed(closes[:35]))
    ema12 = _ema(asc, 12)
    ema26 = _ema(asc, 26)
    if ema12 is None or ema26 is None:
        return None
    return ema12 > ema26


def _volume_ok(volumes: list[float]) -> bool | None:
    """최신 거래량 ≥ 직전 5봉 평균 × 1.5"""
    if len(volumes) < 6:
        return None
    avg5 = sum(volumes[1:6]) / 5
    return avg5 > 0 and volumes[0] >= avg5 * VOLUME_MULT


def _mtf_ok(closes: list[float]) -> bool | None:
    """멀티 타임프레임 확인 (일봉 기반)
    MA5 > MA20 > MA60 — 3개 정배열이면 추세 강함
    일봉 MTF: MA60이 장기 추세(H1 역할), MA20이 중기(M15 역할)
    """
    ma20 = _ma(closes, MA_LONG)
    ma60 = _ma(closes, MA_TREND)
    if ma20 is None or ma60 is None:
        return None  # 데이터 부족 → 필터 패스
    return ma20 > ma60  # 중기 추세가 장기 추세 위에 있어야 함


# ── 시장 환경 ─────────────────────────────────────────

def _kospi_change_pct() -> float | None:
    try:
        import yfinance as yf
        hist = yf.Ticker("^KS11").history(period="3d")
        if len(hist) < 2:
            return None
        return float((hist["Close"].iloc[-1] - hist["Close"].iloc[-2]) / hist["Close"].iloc[-2] * 100)
    except Exception:
        return None


def _market_halted() -> bool:
    chg = _kospi_change_pct()
    return chg is not None and chg <= KOSPI_HALT_PCT


def _vkospi_position_multiplier() -> float:
    """VKOSPI 25 이상이면 0.5 (포지션 절반), 그 외 1.0"""
    v = get_vkospi()
    if v is not None and v >= VKOSPI_HALVE:
        print(f"[quant] VKOSPI={v:.1f} — 포지션 50% 축소")
        return 0.5
    return 1.0


# ── 뉴스 감성 ─────────────────────────────────────────

def _news_blocks_trade(ticker: str, name: str) -> bool:
    cached = _sentiment_cache.get(ticker)
    if cached and (datetime.now() - cached["ts"]).seconds < 14400:
        return cached.get("block_trading", False)
    try:
        from backend.services.news import fetch_stock_news
        from backend.utils.gemini import call_gemini
        news = fetch_stock_news(ticker)[:5]
        if not news:
            _sentiment_cache[ticker] = {"block_trading": False, "ts": datetime.now()}
            return False
        headlines = "\n".join(n.get("title", "") for n in news if n.get("title"))
        prompt = (
            f"{name}({ticker}) 뉴스 분석. JSON만 응답:\n{headlines}\n\n"
            '{"sentiment":0.0,"block_trading":false,"category":"일반"}\n'
            "block_trading: 악재/부정 뉴스면 true"
        )
        resp = call_gemini(prompt)
        clean = resp.strip().strip("```json").strip("```").strip()
        result = json.loads(clean)
        result["ts"] = datetime.now()
        _sentiment_cache[ticker] = result
        return bool(result.get("block_trading", False))
    except Exception:
        return False  # 오류 시 차단하지 않음


# ── 포지션 관리 ───────────────────────────────────────

def _sector_ok(ticker: str, held: set[str]) -> bool:
    sector = SECTOR_MAP.get(ticker)
    if not sector:
        return True
    return sum(1 for t in held if SECTOR_MAP.get(t) == sector) < MAX_SECTOR_POSITIONS


def _daily_loss_exceeded() -> bool:
    today = datetime.now().strftime("%Y-%m-%d")
    trades = _sb().table("auto_trades").select("action, amount").gte("executed_at", today).execute().data or []
    total_buy  = sum(t["amount"] for t in trades if t["action"] == "buy")
    total_sell = sum(t["amount"] for t in trades if t["action"] == "sell")
    if total_buy <= 0:
        return False
    return (total_sell - total_buy) / total_buy * 100 < DAILY_LOSS_LIMIT_PCT


def _order_duplicate(ticker: str, action: str) -> bool:
    today = datetime.now().strftime("%Y-%m-%d")
    r = _sb().table("auto_trades").select("id").eq("ticker", ticker).eq("action", action).gte("executed_at", today).execute()
    return bool(r.data)


# ── 신호 계산 ─────────────────────────────────────────

def _calc_signal(ticker: str, market: str = "KR") -> dict:
    try:
        if market == "US":
            import yfinance as yf
            info = get_us_price_and_fundamentals(ticker)
            hist = yf.Ticker(ticker).history(period="90d")
            if hist.empty:
                return {"signal": "hold", "reason": "데이터 없음", "current_price": None}
            closes  = list(reversed(hist["Close"].dropna().tolist()))
            volumes = list(reversed(hist["Volume"].dropna().tolist()))
        else:
            info  = get_price_and_fundamentals(ticker)
            daily = get_daily_data(ticker, days=MA_TREND + 20)
            closes  = [d["close"]  for d in daily]
            volumes = [d["volume"] for d in daily]
    except Exception as e:
        return {"signal": "hold", "reason": str(e), "current_price": None}

    cp  = info["current_price"]
    per = info["per"]

    if not cp or len(closes) < MA_LONG + 5:
        return {"signal": "hold", "reason": "데이터 부족", "current_price": cp, **info}

    ma5_now   = _ma(closes,     MA_SHORT)
    ma20_now  = _ma(closes,     MA_LONG)
    ma5_prev  = _ma(closes[1:], MA_SHORT)
    ma20_prev = _ma(closes[1:], MA_LONG)

    if not all([ma5_now, ma20_now, ma5_prev, ma20_prev]):
        return {"signal": "hold", "reason": "MA 계산 실패", "current_price": cp}

    golden_cross = ma5_prev <= ma20_prev and ma5_now > ma20_now
    dead_cross   = ma5_prev >= ma20_prev and ma5_now < ma20_now

    rsi     = _rsi(closes)
    macd_ok = _macd_bullish(closes)
    vol_ok  = _volume_ok(volumes)
    mtf_ok  = _mtf_ok(closes)         # MA20 > MA60 (추세 방향 확인)
    per_ok  = per is None or (PER_MIN <= per <= PER_MAX)

    rsi_ok = rsi is None or (RSI_MIN <= rsi <= RSI_MAX)

    all_filters_ok = (
        rsi_ok and
        (macd_ok is None or macd_ok) and
        (vol_ok  is None or vol_ok)  and
        (mtf_ok  is None or mtf_ok)  and
        per_ok
    )

    if golden_cross and all_filters_ok:
        signal = "buy"
        reason = f"골든크로스 RSI={rsi} 거래량OK MTF={'OK' if mtf_ok else '?'} PER={per}"
    elif dead_cross:
        signal = "sell"
        reason = f"데드크로스 (MA{MA_SHORT}<MA{MA_LONG})"
    elif golden_cross:
        fails = []
        if not rsi_ok:         fails.append(f"RSI={rsi}(범위외)")
        if macd_ok is False:   fails.append("MACD하락")
        if vol_ok  is False:   fails.append("거래량부족")
        if mtf_ok  is False:   fails.append("MTF하락추세")
        if not per_ok:         fails.append(f"PER={per}(범위외)")
        signal = "hold"
        reason = f"크로스+필터미통과: {', '.join(fails)}"
    else:
        signal = "hold"
        reason = f"MA{MA_SHORT}={ma5_now:.2f} MA{MA_LONG}={ma20_now:.2f}"

    return {
        "signal":        signal,
        "reason":        reason,
        "current_price": cp,
        "ma5":           round(ma5_now, 2),
        "ma20":          round(ma20_now, 2),
        "rsi":           rsi,
        "macd_ok":       macd_ok,
        "vol_ok":        vol_ok,
        "mtf_ok":        mtf_ok,
        "per":           per,
        "pbr":           info.get("pbr"),
        "w52_high":      info.get("w52_high"),
        "w52_low":       info.get("w52_low"),
    }


# ── 알림 & 기록 ───────────────────────────────────────

def _notify(action: str, ticker: str, market: str, price: float, quantity: int, reason: str):
    action_str = "매수" if action == "buy" else "매도"
    currency   = "$" if market == "US" else "₩"
    msg = f"[자동매매] {action_str} · {ticker} ({market})\n{currency}{price:,.2f} × {quantity}주\n{reason}"
    try:
        from backend.services.telegram_notifier import send_telegram_message
        send_telegram_message(msg)
    except Exception:
        pass


def _record_trade(ticker: str, action: str, price: float, quantity: int, reason: str, order_id: str = ""):
    _sb().table("auto_trades").insert({
        "ticker":      ticker,
        "action":      action,
        "price":       price,
        "quantity":    quantity,
        "amount":      price * quantity,
        "reason":      reason,
        "kis_order_id": order_id,
    }).execute()


# ── 시간 체크 ─────────────────────────────────────────

def _is_trading_hours() -> bool:
    now = datetime.now()
    if now.weekday() >= 5:
        return False
    h, m = now.hour, now.minute
    kr_open = (9, 0)  <= (h, m) <= (15, 30)
    us_open = (h, m) >= (23, 30) or (h, m) <= (6, 0)
    return kr_open or us_open


def _is_force_close_time() -> bool:
    h, m = datetime.now().hour, datetime.now().minute
    return (h, m) >= FORCE_CLOSE_HOUR


# ── 메인 스캔 & 트레이딩 ──────────────────────────────

def scan_and_trade():
    if not _is_trading_hours():
        return

    _ensure_universe()

    if _daily_loss_exceeded():
        print("[quant] 일일 손실 한도 초과 — 매매 중단")
        return

    try:
        holdings = get_holdings()
        held     = {h["ticker"] for h in holdings}
    except Exception as e:
        print(f"[quant] 보유 종목 조회 오류: {e}")
        _notify("sell", "SYSTEM", "KR", 0, 0, f"보유 종목 조회 실패: {e}")
        return

    # ① 강제 청산 (15:00 이후 데이 트레이딩 리스크 관리)
    if _is_force_close_time():
        for h in holdings:
            if _order_duplicate(h["ticker"], "sell"):
                continue
            try:
                result    = sell_market_order(h["ticker"], h["quantity"])
                order_id  = result.get("output", {}).get("ODNO", "")
                _record_trade(h["ticker"], "sell", h["current_price"], h["quantity"], "강제청산 (장마감 30분전)", order_id)
                _notify("sell", h["ticker"], "KR", h["current_price"], h["quantity"], "강제청산")
                _trailing_activated.discard(h["ticker"])
            except Exception as e:
                print(f"[quant] 강제청산 오류 {h['ticker']}: {e}")
                _notify("sell", h["ticker"], "KR", 0, 0, f"강제청산 실패: {e}")
        return

    # 유니버스 마켓 맵
    universe_market_map: dict[str, str] = {}
    try:
        rows = _sb().table("autotrade_watchlist").select("ticker, market").execute().data or []
        universe_market_map = {r["ticker"]: r.get("market", "KR") for r in rows}
    except Exception:
        pass

    # ② 보유 종목 청산 체크
    for h in holdings:
        market = universe_market_map.get(h["ticker"], "KR")
        if market != "KR":
            continue

        # 트레일링 활성화 갱신
        if h["pnl_pct"] >= TRAILING_TRIGGER_PCT:
            _trailing_activated.add(h["ticker"])

        sell_reason = None
        if h["ticker"] in _trailing_activated and h["pnl_pct"] < 0:
            sell_reason = f"트레일링 손절 (본전 하회, {h['pnl_pct']:.1f}%)"
        elif h["pnl_pct"] >= TAKE_PROFIT_PCT:
            sell_reason = f"익절 ({h['pnl_pct']:.1f}%)"
        elif h["pnl_pct"] <= STOP_LOSS_PCT:
            sell_reason = f"손절 ({h['pnl_pct']:.1f}%)"
        else:
            try:
                sig = _calc_signal(h["ticker"], market)
                if sig["signal"] == "sell":
                    sell_reason = sig["reason"]
            except Exception:
                pass

        if sell_reason and not _order_duplicate(h["ticker"], "sell"):
            try:
                result   = sell_market_order(h["ticker"], h["quantity"])
                order_id = result.get("output", {}).get("ODNO", "")
                _record_trade(h["ticker"], "sell", h["current_price"], h["quantity"], sell_reason, order_id)
                _notify("sell", h["ticker"], market, h["current_price"], h["quantity"], sell_reason)
                _trailing_activated.discard(h["ticker"])
            except Exception as e:
                print(f"[quant] 매도 오류 {h['ticker']}: {e}")
                _notify("sell", h["ticker"], market, 0, 0, f"매도 실패: {e}")

    # ③ 신규 매수
    if _market_halted():
        print("[quant] 코스피 급락 — 신규 진입 중단")
        return

    if len(held) >= MAX_POSITIONS:
        return

    try:
        cash = get_account_cash()
    except Exception as e:
        print(f"[quant] 잔고 조회 오류: {e}")
        return

    if cash < MAX_AMOUNT_PER_STOCK:
        print(f"[quant] 잔고 부족: {cash:,.0f}원")
        return

    try:
        journal_stocks  = _sb().table("quant_stocks").select("ticker, name, market").execute().data or []
        universe_stocks = _sb().table("autotrade_watchlist").select("ticker, name, market").execute().data or []
        seen: set[str] = set()
        all_stocks: list[dict] = []
        for s in universe_stocks + journal_stocks:
            if s["ticker"] not in seen:
                all_stocks.append(s)
                seen.add(s["ticker"])

        held = {h["ticker"] for h in get_holdings()}

        for stock in all_stocks:
            ticker = stock["ticker"]
            market = (stock.get("market") or "KR").upper()

            if market != "KR":
                continue
            if ticker in held or len(held) >= MAX_POSITIONS:
                break
            if not _sector_ok(ticker, held):
                continue
            if _order_duplicate(ticker, "buy"):
                continue

            try:
                sig = _calc_signal(ticker, market)
                if sig["signal"] != "buy" or not sig.get("current_price"):
                    continue

                # 5단계 재무 필터
                if USE_FINANCIAL_FILTER:
                    try:
                        from backend.services.financial_filter import passes_5stage_filter
                        ok, reason_f, _ = passes_5stage_filter(ticker, market)
                        if not ok:
                            print(f"[quant] {ticker} 재무 필터 탈락: {reason_f}")
                            continue
                    except Exception:
                        pass  # 필터 오류 시 통과

                if _news_blocks_trade(ticker, stock.get("name", ticker)):
                    print(f"[quant] {ticker} 부정 뉴스 — 진입 차단")
                    continue

                # VKOSPI 포지션 축소
                pos_mult = _vkospi_position_multiplier()
                amount   = int(MAX_AMOUNT_PER_STOCK * pos_mult)
                qty = calculate_quantity(amount, sig["current_price"])
                if qty <= 0:
                    continue

                result   = buy_market_order(ticker, qty)
                order_id = result.get("output", {}).get("ODNO", "")
                _record_trade(ticker, "buy", sig["current_price"], qty, sig["reason"], order_id)
                _notify("buy", ticker, market, sig["current_price"], qty, sig["reason"])
                held.add(ticker)

            except Exception as e:
                print(f"[quant] {ticker} 처리 오류: {e}")
                err_str = str(e)
                if any(code in err_str for code in ["401", "403", "API"]):
                    _notify("buy", "SYSTEM", "KR", 0, 0, f"API 오류로 자동매매 중단: {e}")
                    return

    except Exception as e:
        print(f"[quant] 매수 스캔 오류: {e}")


# ── 대시보드용 시그널 스냅샷 ──────────────────────────

def get_universe_signals() -> list[dict]:
    _ensure_universe()

    system_stocks = _sb().table("autotrade_watchlist").select("ticker, name, market").execute().data or []
    seen = {s["ticker"] for s in system_stocks}
    universe = [{"source": "system", **s} for s in system_stocks]

    journal_stocks = _sb().table("quant_stocks").select("ticker, name, market").execute().data or []
    for s in journal_stocks:
        if s["ticker"] not in seen:
            universe.append({"source": "journal", **s})
            seen.add(s["ticker"])

    # 최근 저널 노트
    note_map: dict[str, str] = {}
    try:
        all_qs = _sb().table("quant_stocks").select("id, ticker").execute().data or []
        for s in all_qs:
            latest = (
                _sb().table("journal_entries")
                .select("analysis_text")
                .eq("stock_id", s["id"])
                .order("created_at", desc=True)
                .limit(1)
                .execute()
                .data or []
            )
            if latest and latest[0].get("analysis_text"):
                note_map[s["ticker"]] = latest[0]["analysis_text"][:80]
    except Exception:
        pass

    results = []
    for stock in universe:
        market = (stock.get("market") or "KR").upper()
        try:
            sig = _calc_signal(stock["ticker"], market)
            results.append({
                "ticker": stock["ticker"],
                "name":   stock["name"],
                "market": market,
                "source": stock["source"],
                "note":   note_map.get(stock["ticker"], ""),
                **sig,
            })
        except Exception as e:
            results.append({
                "ticker": stock["ticker"],
                "name":   stock["name"],
                "market": market,
                "source": stock["source"],
                "note":   note_map.get(stock["ticker"], ""),
                "signal": "hold",
                "reason": str(e),
            })
    return results

"""
백테스트 엔진 — MA5/MA20 골든크로스 + 멀티 필터 전략

기본 전략:
  진입: MA5 > MA20 골든크로스 + RSI 40~60 + MACD 방향 + 거래량 1.5배
  청산: 데드크로스 / 손절 -5% / 익절 +10% / 트레일링

지표:
  수익률, 샤프지수, MDD, 승률, 평균보유일
  수수료 0.015% + 슬리피지 0.1% 반영
"""
import math
from datetime import datetime, timedelta


COMMISSION  = 0.00015  # 수수료 0.015%
SLIPPAGE    = 0.001    # 슬리피지 0.1%
STOP_LOSS   = -0.05
TAKE_PROFIT = 0.10
TRAILING_TRIGGER = 0.05
RISK_FREE_RATE   = 0.035  # 무위험수익률 3.5% (연)


def _ma(prices: list[float], n: int) -> float | None:
    if len(prices) < n:
        return None
    return sum(prices[:n]) / n


def _rsi(closes: list[float], period: int = 14) -> float | None:
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
    return 100 - (100 / (1 + avg_gain / avg_loss))


def _ema(prices_asc: list[float], period: int) -> float | None:
    if len(prices_asc) < period:
        return None
    k = 2 / (period + 1)
    ema = sum(prices_asc[:period]) / period
    for p in prices_asc[period:]:
        ema = p * k + ema * (1 - k)
    return ema


def _get_historical_data(ticker: str, market: str, days: int = 200) -> list[dict]:
    """OHLCV 데이터 수집 (최신순)"""
    if market == "US":
        import yfinance as yf
        hist = yf.Ticker(ticker).history(period=f"{days + 20}d")
        if hist.empty:
            return []
        return [
            {
                "date":   str(hist.index[i].date()),
                "close":  float(hist["Close"].iloc[i]),
                "volume": float(hist["Volume"].iloc[i]),
            }
            for i in range(len(hist))
        ][::-1][:days]
    else:
        from backend.services.kis_trader import get_daily_data
        raw = get_daily_data(ticker, days=days)
        return [{"date": "", "close": d["close"], "volume": d["volume"]} for d in raw]


def _sharpe(returns: list[float], trading_days: int = 252) -> float | None:
    if len(returns) < 5:
        return None
    n    = len(returns)
    mean = sum(returns) / n
    var  = sum((r - mean) ** 2 for r in returns) / n
    std  = math.sqrt(var) if var > 0 else 0
    if std == 0:
        return None
    annualized_ret = mean * trading_days
    annualized_std = std * math.sqrt(trading_days)
    return round((annualized_ret - RISK_FREE_RATE) / annualized_std, 2)


def _mdd(equity_curve: list[float]) -> float:
    if not equity_curve:
        return 0.0
    peak = equity_curve[0]
    mdd  = 0.0
    for v in equity_curve:
        peak = max(peak, v)
        dd   = (v - peak) / peak
        mdd  = min(mdd, dd)
    return round(mdd * 100, 2)


def run_backtest(ticker: str, market: str = "KR", days: int = 180) -> dict:
    """
    단일 종목 백테스트 실행
    Returns: {
      total_return, sharpe, mdd, win_rate, trade_count,
      avg_hold_days, trades, equity_curve, params
    }
    """
    data = _get_historical_data(ticker, market, days=days + 30)
    if len(data) < 30:
        return {"error": f"데이터 부족 ({len(data)}일)"}

    # 최신순 → 오름차순(시간순)으로 변환
    data_asc = list(reversed(data))
    closes    = [d["close"]  for d in data_asc]
    volumes   = [d["volume"] for d in data_asc]

    initial_capital = 500_000.0
    capital    = initial_capital
    position   = None  # {entry_price, quantity, entry_idx, trailing_activated}
    trades: list[dict] = []
    equity_curve: list[float] = [capital]
    daily_returns: list[float] = []

    for i in range(25, len(closes)):
        # 현재 시점 기준 최신순 슬라이스
        recent = list(reversed(closes[:i + 1]))
        vols   = list(reversed(volumes[:i + 1]))
        cp     = closes[i]

        if position:
            entry  = position["entry_price"]
            pnl_pct = (cp - entry) / entry * 100

            # 트레일링 활성화
            if pnl_pct >= TRAILING_TRIGGER * 100:
                position["trailing_activated"] = True

            sell_reason = None
            if position["trailing_activated"] and pnl_pct < 0:
                sell_reason = "트레일링"
            elif pnl_pct <= STOP_LOSS * 100:
                sell_reason = f"손절 {pnl_pct:.1f}%"
            elif pnl_pct >= TAKE_PROFIT * 100:
                sell_reason = f"익절 {pnl_pct:.1f}%"
            else:
                # 데드크로스 체크
                ma5_now  = _ma(recent, 5)
                ma20_now = _ma(recent, 20)
                ma5_prev  = _ma(recent[1:], 5)
                ma20_prev = _ma(recent[1:], 20)
                if all([ma5_now, ma20_now, ma5_prev, ma20_prev]):
                    if ma5_prev >= ma20_prev and ma5_now < ma20_now:
                        sell_reason = "데드크로스"

            if sell_reason:
                sell_price = cp * (1 - SLIPPAGE)
                sell_fee   = sell_price * position["quantity"] * COMMISSION
                proceeds   = sell_price * position["quantity"] - sell_fee
                hold_days  = i - position["entry_idx"]
                net_pnl_pct = (sell_price - entry) / entry * 100

                trades.append({
                    "entry_idx":  position["entry_idx"],
                    "exit_idx":   i,
                    "entry_price": round(entry, 4),
                    "exit_price":  round(sell_price, 4),
                    "pnl_pct":     round(net_pnl_pct, 2),
                    "hold_days":   hold_days,
                    "reason":      sell_reason,
                })
                capital  += proceeds - (entry * position["quantity"])
                daily_returns.append(net_pnl_pct / 100)
                position = None

        else:
            # 골든크로스 체크
            ma5_now   = _ma(recent, 5)
            ma20_now  = _ma(recent, 20)
            ma5_prev  = _ma(recent[1:], 5)
            ma20_prev = _ma(recent[1:], 20)

            if not all([ma5_now, ma20_now, ma5_prev, ma20_prev]):
                equity_curve.append(capital)
                continue

            golden_cross = ma5_prev <= ma20_prev and ma5_now > ma20_now

            # 보조 필터
            rsi_val = _rsi(recent)
            rsi_ok  = rsi_val is None or (40 <= rsi_val <= 60)

            asc_slice = closes[:i + 1]
            ema12 = _ema(asc_slice[-35:], 12) if len(asc_slice) >= 12 else None
            ema26 = _ema(asc_slice[-35:], 26) if len(asc_slice) >= 26 else None
            macd_ok = True if (ema12 is None or ema26 is None) else ema12 > ema26

            vol_ok = True
            if len(vols) >= 6:
                avg5   = sum(vols[-6:-1]) / 5
                vol_ok = avg5 > 0 and vols[-1] >= avg5 * 1.5

            if golden_cross and rsi_ok and macd_ok and vol_ok and capital >= 500_000:
                buy_price  = cp * (1 + SLIPPAGE)
                buy_fee    = buy_price * COMMISSION
                qty        = int(initial_capital // buy_price)
                if qty > 0:
                    cost     = buy_price * qty * (1 + COMMISSION)
                    position = {
                        "entry_price":         buy_price,
                        "quantity":            qty,
                        "entry_idx":           i,
                        "trailing_activated":  False,
                    }

        equity_curve.append(capital + (cp * position["quantity"] if position else 0))

    # 미청산 포지션 강제 청산
    if position and closes:
        cp         = closes[-1]
        sell_price = cp * (1 - SLIPPAGE)
        pnl_pct    = (sell_price - position["entry_price"]) / position["entry_price"] * 100
        trades.append({
            "entry_idx":  position["entry_idx"],
            "exit_idx":   len(closes) - 1,
            "entry_price": round(position["entry_price"], 4),
            "exit_price":  round(sell_price, 4),
            "pnl_pct":     round(pnl_pct, 2),
            "hold_days":   len(closes) - 1 - position["entry_idx"],
            "reason":      "기간만료",
        })
        final_val = sell_price * position["quantity"]
        capital   += final_val - (position["entry_price"] * position["quantity"])

    # 지표 계산
    total_return = round((capital - initial_capital) / initial_capital * 100, 2)
    wins         = [t for t in trades if t["pnl_pct"] > 0]
    win_rate     = round(len(wins) / len(trades) * 100, 1) if trades else 0
    avg_hold     = round(sum(t["hold_days"] for t in trades) / len(trades), 1) if trades else 0
    sharpe       = _sharpe(daily_returns)
    mdd_val      = _mdd(equity_curve)

    # 샤프지수 1.0+ / MDD -15% 이내 검증
    ready_for_live = (
        sharpe is not None and sharpe >= 1.0 and
        mdd_val >= -15.0 and
        win_rate >= 40 and
        len(trades) >= 3
    )

    return {
        "ticker":        ticker,
        "market":        market,
        "days":          days,
        "total_return":  total_return,
        "sharpe":        sharpe,
        "mdd":           mdd_val,
        "win_rate":      win_rate,
        "trade_count":   len(trades),
        "avg_hold_days": avg_hold,
        "ready_for_live": ready_for_live,
        "verdict":       "✅ 실전 투입 가능" if ready_for_live else "⚠️ 전략 조정 필요",
        "trades":        trades[-20:],  # 최근 20건
        "equity_curve":  equity_curve[-days:],
        "params": {
            "commission":  COMMISSION,
            "slippage":    SLIPPAGE,
            "stop_loss":   STOP_LOSS,
            "take_profit": TAKE_PROFIT,
        },
    }


def run_portfolio_backtest(tickers: list[dict], days: int = 180) -> dict:
    """포트폴리오 백테스트 — 종목별 결과 + 종합"""
    results = []
    for s in tickers:
        try:
            r = run_backtest(s["ticker"], s.get("market", "KR"), days)
            results.append(r)
        except Exception as e:
            results.append({"ticker": s["ticker"], "error": str(e)})

    valid = [r for r in results if "total_return" in r]
    if not valid:
        return {"results": results, "summary": {}}

    avg_return = round(sum(r["total_return"] for r in valid) / len(valid), 2)
    avg_sharpe_vals = [r["sharpe"] for r in valid if r.get("sharpe") is not None]
    avg_sharpe = round(sum(avg_sharpe_vals) / len(avg_sharpe_vals), 2) if avg_sharpe_vals else None
    worst_mdd = min((r["mdd"] for r in valid), default=0)
    pass_count = sum(1 for r in valid if r.get("ready_for_live"))

    return {
        "results": results,
        "summary": {
            "avg_return":     avg_return,
            "avg_sharpe":     avg_sharpe,
            "worst_mdd":      worst_mdd,
            "pass_count":     pass_count,
            "total_count":    len(valid),
            "verdict":        "✅ 포트폴리오 실전 가능" if pass_count >= len(valid) * 0.6 else "⚠️ 일부 종목 조정 필요",
        },
    }

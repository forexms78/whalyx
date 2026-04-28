"""
5단계 재무 필터

Stage 1 — 기본 제거:  시총 300억 미만 제외, 시장 경고 종목 제외
Stage 2 — 수익성:    PER 5~30, ROE 8% 이상, 영업이익 흑자
Stage 3 — 안정성:    부채비율 200% 이하, 유동비율 100% 이상
Stage 4 — 성장성:    매출 YoY +5%, 영업이익 YoY 증가
Stage 5 — 모멘텀:    최근 20일 코스피 대비 초과수익

KR: KIS API + yfinance (.KS suffix)
US: yfinance
"""
import os
import requests
from datetime import datetime, timedelta


def _kis_headers(tr_id: str) -> dict:
    from backend.services.kis_trader import get_access_token, APP_KEY, APP_SECRET
    return {
        "authorization": f"Bearer {get_access_token()}",
        "appkey": APP_KEY,
        "appsecret": APP_SECRET,
        "tr_id": tr_id,
        "content-type": "application/json; charset=utf-8",
    }


def _safe_float(v) -> float | None:
    try:
        f = float(v)
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None


def _get_kr_fundamentals(ticker: str) -> dict:
    """KIS + yfinance로 한국 주식 재무 데이터 수집"""
    from backend.services.kis_trader import BASE_URL
    result: dict = {}

    # KIS 기본 가격 정보 (PER, PBR, 시가총액)
    try:
        res = requests.get(
            f"{BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price",
            headers=_kis_headers("FHKST01010100"),
            params={"fid_cond_mrkt_div_code": "J", "fid_input_iscd": ticker},
            timeout=10,
        )
        out = res.json().get("output", {})
        result["per"]    = _safe_float(out.get("per"))
        result["pbr"]    = _safe_float(out.get("pbr"))
        result["mktcap"] = _safe_float(out.get("hts_avls"))  # 시가총액 (억원)
        result["warn"]   = out.get("invt_caful_isse_yn", "N")  # 투자주의 여부
    except Exception:
        pass

    # yfinance KS suffix로 추가 재무 데이터
    try:
        import yfinance as yf
        info = yf.Ticker(f"{ticker}.KS").info
        result["roe"]            = info.get("returnOnEquity")
        result["debt_to_equity"] = info.get("debtToEquity")
        result["current_ratio"]  = info.get("currentRatio")
        result["revenue_growth"] = info.get("revenueGrowth")
        result["earnings_growth"]= info.get("earningsGrowth")
        result["profit_margins"] = info.get("profitMargins")
        if not result.get("per"):
            result["per"] = info.get("trailingPE") or info.get("forwardPE")
        if not result.get("mktcap"):
            mc = info.get("marketCap")
            if mc:
                result["mktcap"] = mc / 1e8  # 원 → 억원
    except Exception:
        pass

    return result


def _get_us_fundamentals(ticker: str) -> dict:
    """yfinance로 미국 주식 재무 데이터 수집"""
    try:
        import yfinance as yf
        info = yf.Ticker(ticker).info
        mc = info.get("marketCap")
        return {
            "per":            info.get("trailingPE") or info.get("forwardPE"),
            "pbr":            info.get("priceToBook"),
            "mktcap":         mc / 1e8 if mc else None,  # 달러 → 억달러 (비교용)
            "roe":            info.get("returnOnEquity"),
            "debt_to_equity": info.get("debtToEquity"),
            "current_ratio":  info.get("currentRatio"),
            "revenue_growth": info.get("revenueGrowth"),
            "earnings_growth":info.get("earningsGrowth"),
            "profit_margins": info.get("profitMargins"),
        }
    except Exception:
        return {}


def _get_kospi_return_20d() -> float | None:
    """코스피 최근 20일 수익률"""
    try:
        import yfinance as yf
        hist = yf.Ticker("^KS11").history(period="30d")
        if len(hist) < 20:
            return None
        return float((hist["Close"].iloc[-1] - hist["Close"].iloc[-20]) / hist["Close"].iloc[-20] * 100)
    except Exception:
        return None


def _get_stock_return_20d(ticker: str, market: str) -> float | None:
    """종목 최근 20일 수익률"""
    try:
        import yfinance as yf
        yt = f"{ticker}.KS" if market == "KR" else ticker
        hist = yf.Ticker(yt).history(period="30d")
        if len(hist) < 20:
            return None
        return float((hist["Close"].iloc[-1] - hist["Close"].iloc[-20]) / hist["Close"].iloc[-20] * 100)
    except Exception:
        return None


def passes_5stage_filter(ticker: str, market: str = "KR") -> tuple[bool, str, dict]:
    """
    5단계 재무 필터 — (통과여부, 실패이유, 재무데이터)
    데이터 조회 실패 시 통과 처리 (보수적 접근)
    """
    fd = _get_kr_fundamentals(ticker) if market == "KR" else _get_us_fundamentals(ticker)

    # Stage 1 — 기본 제거
    mktcap = fd.get("mktcap")
    if market == "KR" and mktcap is not None and mktcap < 300:
        return False, f"S1: 시총 {mktcap:.0f}억 (300억 미만)", fd
    if fd.get("warn") == "Y":
        return False, "S1: 투자주의 종목", fd

    # Stage 2 — 수익성
    per = fd.get("per")
    if per is not None and not (5 <= float(per) <= 30):
        return False, f"S2: PER {per:.1f} (5~30 범위 외)", fd
    roe = fd.get("roe")
    if roe is not None and float(roe) < 0.08:
        return False, f"S2: ROE {roe*100:.1f}% (8% 미만)", fd
    margins = fd.get("profit_margins")
    if margins is not None and float(margins) < 0:
        return False, "S2: 영업손실 종목", fd

    # Stage 3 — 안정성
    dte = fd.get("debt_to_equity")
    if dte is not None and float(dte) > 200:
        return False, f"S3: 부채비율 {dte:.0f}% (200% 초과)", fd
    cr = fd.get("current_ratio")
    if cr is not None and float(cr) < 1.0:
        return False, f"S3: 유동비율 {cr:.2f} (1.0 미만)", fd

    # Stage 4 — 성장성
    rev_growth = fd.get("revenue_growth")
    if rev_growth is not None and float(rev_growth) < 0.05:
        return False, f"S4: 매출성장 {rev_growth*100:.1f}% (5% 미만)", fd
    earn_growth = fd.get("earnings_growth")
    if earn_growth is not None and float(earn_growth) < 0:
        return False, "S4: 영업이익 YoY 감소", fd

    # Stage 5 — 모멘텀 (코스피 대비 초과수익)
    kospi_ret  = _get_kospi_return_20d()
    stock_ret  = _get_stock_return_20d(ticker, market)
    if kospi_ret is not None and stock_ret is not None:
        if stock_ret < kospi_ret:
            return False, f"S5: 20일 수익률 {stock_ret:.1f}% < 코스피 {kospi_ret:.1f}%", fd

    return True, "OK", fd

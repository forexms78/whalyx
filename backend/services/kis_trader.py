import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

_KST = ZoneInfo("Asia/Seoul")

import requests

APP_KEY = os.getenv("KIS_APP_KEY", "")
APP_SECRET = os.getenv("KIS_APP_SECRET", "")
ACCOUNT_NO = os.getenv("KIS_ACCOUNT_NO", "")
# ISA 계좌는 상품코드가 01이 아님 (예: 26·60). KIS_ACCOUNT_SUFFIX로 명시적으로 지정 가능
ACCOUNT_SUFFIX = os.getenv("KIS_ACCOUNT_SUFFIX", "")
IS_MOCK = os.getenv("KIS_MOCK", "true").lower() == "true"

BASE_URL = (
    "https://openapivts.koreainvestment.com:29443" if IS_MOCK
    else "https://openapi.koreainvestment.com:9443"
)

_token_cache: dict = {"token": None, "expires_at": None}


def get_access_token() -> str:
    now = datetime.now(_KST)
    if _token_cache["token"] and _token_cache["expires_at"] and now < _token_cache["expires_at"]:
        return _token_cache["token"]
    res = requests.post(
        f"{BASE_URL}/oauth2/tokenP",
        json={"grant_type": "client_credentials", "appkey": APP_KEY, "appsecret": APP_SECRET},
        timeout=10,
    )
    res.raise_for_status()
    data = res.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["expires_at"] = now + timedelta(hours=23)
    return _token_cache["token"]


def _headers(tr_id: str) -> dict:
    return {
        "authorization": f"Bearer {get_access_token()}",
        "appkey": APP_KEY,
        "appsecret": APP_SECRET,
        "tr_id": tr_id,
        "content-type": "application/json; charset=utf-8",
    }


def get_current_price(ticker: str) -> float:
    res = requests.get(
        f"{BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price",
        headers=_headers("FHKST01010100"),
        params={"fid_cond_mrkt_div_code": "J", "fid_input_iscd": ticker},
        timeout=10,
    )
    res.raise_for_status()
    return float(res.json()["output"]["stck_prpr"])


def get_price_and_fundamentals(ticker: str) -> dict:
    """현재가 + PER/PBR/시가총액 — KIS 주식현재가 시세"""
    res = requests.get(
        f"{BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price",
        headers=_headers("FHKST01010100"),
        params={"fid_cond_mrkt_div_code": "J", "fid_input_iscd": ticker},
        timeout=10,
    )
    res.raise_for_status()
    out = res.json().get("output", {})
    return {
        "current_price": float(out.get("stck_prpr", 0)),
        "per": _safe_float(out.get("per")),
        "pbr": _safe_float(out.get("pbr")),
        "w52_high": _safe_float(out.get("w52_hgpr")),
        "w52_low": _safe_float(out.get("w52_lwpr")),
    }


def get_daily_data(ticker: str, days: int = 40) -> list[dict]:
    """일별 종가 + 거래량 리스트 (최신순) — KIS"""
    end = datetime.now(_KST).strftime("%Y%m%d")
    start = (datetime.now() - timedelta(days=days + 10)).strftime("%Y%m%d")
    res = requests.get(
        f"{BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-price",
        headers=_headers("FHKST01010400"),
        params={
            "fid_cond_mrkt_div_code": "J",
            "fid_input_iscd": ticker,
            "fid_org_adj_prc": "1",
            "fid_period_div_code": "D",
            "fid_input_date_1": start,
            "fid_input_date_2": end,
        },
        timeout=10,
    )
    res.raise_for_status()
    output = res.json().get("output", [])
    result = []
    for r in output:
        close = r.get("stck_clpr")
        vol = r.get("acml_vol")
        if close and vol:
            result.append({"close": float(close), "volume": float(vol)})
    return result[:days]


def _inquire_balance_raw() -> dict:
    """inquire-balance output2 원본 반환 (내부 공통 호출)"""
    acc_no, acc_suffix = (ACCOUNT_NO.split("-") + [ACCOUNT_SUFFIX or "01"])[:2]
    tr_id = "VTTC8434R" if IS_MOCK else "TTTC8434R"
    res = requests.get(
        f"{BASE_URL}/uapi/domestic-stock/v1/trading/inquire-balance",
        headers=_headers(tr_id),
        params={
            "CANO": acc_no,
            "ACNT_PRDT_CD": acc_suffix,
            "AFHR_FLPR_YN": "N",
            "OFL_YN": "",
            "INQR_DVSN": "02",
            "UNPR_DVSN": "01",
            "FUND_STTL_ICLD_YN": "N",
            "FNCG_AMT_AUTO_RDPT_YN": "N",
            "PRCS_DVSN": "01",
            "CTX_AREA_FK100": "",
            "CTX_AREA_NK100": "",
        },
        timeout=10,
    )
    res.raise_for_status()
    return res.json()


def get_account_cash() -> float:
    """주문 가능 예수금"""
    output2 = _inquire_balance_raw().get("output2", [{}])
    if output2:
        v = output2[0].get("nxdy_excc_amt") or output2[0].get("dnca_tot_amt") or "0"
        return float(v)
    return 0.0


def get_account_summary() -> dict:
    """계좌 잔고 전체 요약 — 예수금·총평가금액·매입금액·평가손익·수익률"""
    raw = _inquire_balance_raw()
    out2 = raw.get("output2", [{}])
    o = out2[0] if out2 else {}

    def _f(key: str) -> float:
        try:
            return float(o.get(key) or 0)
        except (TypeError, ValueError):
            return 0.0

    return {
        "cash":          _f("nxdy_excc_amt") or _f("dnca_tot_amt"),   # 주문가능 예수금
        "deposit_total": _f("dnca_tot_amt"),                           # 예수금 총액
        "total_eval":    _f("tot_evlu_amt"),                           # 총 평가금액
        "buy_total":     _f("pchs_amt_smtl_amt"),                      # 매입금액 합계
        "eval_total":    _f("evlu_amt_smtl_amt"),                      # 평가금액 합계
        "pnl_amount":    _f("evlu_pfls_smtl_amt"),                     # 평가손익 합계
        "pnl_pct":       round(float(o.get("asst_icdc_erng_rt") or 0), 2),  # 수익률
        "today_buy":     _f("thdt_buys_amt"),                          # 금일 매수금액
        "today_sell":    _f("thdt_sll_amt"),                           # 금일 매도금액
        "net_asset":     _f("nass_amt"),                               # 순자산
    }


def get_daily_prices(ticker: str, days: int = 30) -> list[float]:
    """일별 종가 리스트 (최신순) — KIS 주식 기간별 시세"""
    end = datetime.now(_KST).strftime("%Y%m%d")
    start = (datetime.now() - timedelta(days=days + 10)).strftime("%Y%m%d")
    res = requests.get(
        f"{BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-price",
        headers=_headers("FHKST01010400"),
        params={
            "fid_cond_mrkt_div_code": "J",
            "fid_input_iscd": ticker,
            "fid_org_adj_prc": "1",
            "fid_period_div_code": "D",
            "fid_input_date_1": start,
            "fid_input_date_2": end,
        },
        timeout=10,
    )
    res.raise_for_status()
    output = res.json().get("output", [])
    return [float(r["stck_clpr"]) for r in output if r.get("stck_clpr")][:days]


def get_vkospi() -> float | None:
    """VKOSPI (한국판 VIX) — KIS 지수 시세로 조회"""
    try:
        res = requests.get(
            f"{BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price",
            headers=_headers("FHPUP02100000"),
            params={"fid_cond_mrkt_div_code": "U", "fid_input_iscd": "500"},
            timeout=10,
        )
        out = res.json().get("output", {})
        v = out.get("bstp_nmix_prpr")
        return float(v) if v else None
    except Exception:
        # KIS VKOSPI 실패 시 ATR 기반 대체 계산
        try:
            import yfinance as yf
            hist = yf.Ticker("^KS11").history(period="25d")
            if len(hist) < 14:
                return None
            # ATR 기반 변동성 (14일)
            highs  = hist["High"].tolist()[-14:]
            lows   = hist["Low"].tolist()[-14:]
            closes = hist["Close"].tolist()[-15:]
            trs    = [max(highs[i] - lows[i], abs(highs[i] - closes[i]), abs(lows[i] - closes[i])) for i in range(14)]
            atr    = sum(trs) / 14
            # ATR을 가격 대비 % → VIX 스케일로 근사
            vkospi_approx = (atr / closes[-1]) * 100 * 15
            return round(vkospi_approx, 2)
        except Exception:
            return None


def get_us_price_and_fundamentals(ticker: str) -> dict:
    """yfinance로 미국 주식 현재가 + PER/PBR/52주 고저"""
    import yfinance as yf
    t = yf.Ticker(ticker)
    # fast_info가 info보다 안정적 (단순 가격 데이터)
    try:
        fi = t.fast_info
        cp = _safe_float(getattr(fi, "last_price", None))
        w52_high = _safe_float(getattr(fi, "year_high", None))
        w52_low = _safe_float(getattr(fi, "year_low", None))
    except Exception:
        hist = t.history(period="5d")
        cp = float(hist["Close"].iloc[-1]) if not hist.empty else None
        w52_high = None
        w52_low = None

    # PER/PBR은 info에서만 가져올 수 있음 — 실패해도 진행
    per, pbr = None, None
    try:
        info = t.info
        per = _safe_float(info.get("trailingPE") or info.get("forwardPE"))
        pbr = _safe_float(info.get("priceToBook"))
        if w52_high is None:
            w52_high = _safe_float(info.get("fiftyTwoWeekHigh"))
        if w52_low is None:
            w52_low = _safe_float(info.get("fiftyTwoWeekLow"))
    except Exception:
        pass

    return {
        "current_price": cp,
        "per": per,
        "pbr": pbr,
        "w52_high": w52_high,
        "w52_low": w52_low,
    }


def get_us_daily_prices(ticker: str, days: int = 30) -> list[float]:
    """yfinance로 미국 주식 일별 종가 리스트 (최신순)"""
    import yfinance as yf
    try:
        hist = yf.Ticker(ticker).history(period=f"{days + 15}d")
        closes = hist["Close"].dropna().tolist()
        return list(reversed(closes))[:days]
    except Exception:
        return []


EXCHANGE_MAP: dict[str, str] = {
    "AAPL": "NASD", "MSFT": "NASD", "NVDA": "NASD", "GOOGL": "NASD",
    "AMZN": "NASD", "META": "NASD", "TSLA": "NASD", "AVGO": "NASD",
    "LLY":  "NYSE", "JPM":  "NYSE", "V":    "NYSE", "BRK-B": "NYSE",
}


def get_ticker_exchange(ticker: str) -> str:
    return EXCHANGE_MAP.get(ticker, "NASD")


def get_us_current_price(ticker: str) -> float:
    import yfinance as yf
    t = yf.Ticker(ticker)
    try:
        return float(t.fast_info.last_price)
    except Exception:
        hist = t.history(period="2d")
        if hist.empty:
            raise ValueError(f"{ticker} 가격 조회 실패")
        return float(hist["Close"].iloc[-1])


def get_us_account_cash_usd() -> float:
    """해외주식 주문 가능 달러 잔고"""
    acc_no, acc_suffix = (ACCOUNT_NO.split("-") + [ACCOUNT_SUFFIX or "01"])[:2]
    tr_id = "VTRP6504R" if IS_MOCK else "CTRP6504R"
    res = requests.get(
        f"{BASE_URL}/uapi/overseas-stock/v1/trading/inquire-present-balance",
        headers=_headers(tr_id),
        params={
            "CANO":              acc_no,
            "ACNT_PRDT_CD":      acc_suffix,
            "WCRC_FRCR_DVSN_CD": "02",
            "NATN_CD":           "840",
            "TR_MKET_CD":        "00",
            "INQR_DVSN_CD":      "00",
        },
        timeout=10,
    )
    res.raise_for_status()
    output2 = res.json().get("output2", [{}])
    if output2:
        v = (
            output2[0].get("frcr_drwg_psbl_amt_1")
            or output2[0].get("frcr_evlu_amt2")
            or "0"
        )
        return float(v)
    return 0.0


def get_us_holdings() -> list:
    """해외주식 보유 종목 (NASD + NYSE)"""
    acc_no, acc_suffix = (ACCOUNT_NO.split("-") + [ACCOUNT_SUFFIX or "01"])[:2]
    tr_id = "VTTS3012R" if IS_MOCK else "TTTS3012R"
    all_holdings: list[dict] = []
    seen: set[str] = set()
    for exchange in ("NASD", "NYSE"):
        try:
            res = requests.get(
                f"{BASE_URL}/uapi/overseas-stock/v1/trading/inquire-balance",
                headers=_headers(tr_id),
                params={
                    "CANO":           acc_no,
                    "ACNT_PRDT_CD":   acc_suffix,
                    "OVRS_EXCG_CD":   exchange,
                    "TR_CRCY_CD":     "USD",
                    "CTX_AREA_FK200": "",
                    "CTX_AREA_NK200": "",
                },
                timeout=10,
            )
            res.raise_for_status()
            for h in res.json().get("output1", []):
                qty    = int(h.get("ovrs_cblc_qty", 0))
                ticker = h.get("ovrs_pdno", "")
                if qty > 0 and ticker and ticker not in seen:
                    all_holdings.append({
                        "ticker":        ticker,
                        "name":          h.get("ovrs_item_name", ""),
                        "quantity":      qty,
                        "avg_price":     float(h.get("pchs_avg_pric", 0)),
                        "current_price": float(h.get("now_pric2", 0)),
                        "pnl_pct":       float(h.get("evlu_pfls_rt", 0)),
                        "exchange":      exchange,
                    })
                    seen.add(ticker)
        except Exception:
            pass
    return all_holdings


def buy_us_market_order(ticker: str, quantity: int, exchange: str = "") -> dict:
    if quantity <= 0:
        return {"error": "수량이 0이하"}
    if not exchange:
        exchange = get_ticker_exchange(ticker)
    acc_no, acc_suffix = (ACCOUNT_NO.split("-") + [ACCOUNT_SUFFIX or "01"])[:2]
    tr_id = "VTTS0308U" if IS_MOCK else "TTTS0308U"
    price = get_us_current_price(ticker)
    limit_price = f"{price * 1.005:.2f}"
    res = requests.post(
        f"{BASE_URL}/uapi/overseas-stock/v1/trading/order",
        headers=_headers(tr_id),
        json={
            "CANO":          acc_no,
            "ACNT_PRDT_CD":  acc_suffix,
            "OVRS_EXCG_CD":  exchange,
            "PDNO":          ticker,
            "ORD_DVSN":      "00",
            "ORD_QTY":       str(quantity),
            "OVRS_ORD_UNPR": limit_price,
        },
        timeout=10,
    )
    res.raise_for_status()
    return res.json()


def sell_us_market_order(ticker: str, quantity: int, exchange: str = "") -> dict:
    if quantity <= 0:
        return {"error": "수량이 0이하"}
    if not exchange:
        exchange = get_ticker_exchange(ticker)
    acc_no, acc_suffix = (ACCOUNT_NO.split("-") + [ACCOUNT_SUFFIX or "01"])[:2]
    tr_id = "VTTS0307U" if IS_MOCK else "TTTS0307U"
    price = get_us_current_price(ticker)
    limit_price = f"{price * 0.995:.2f}"
    res = requests.post(
        f"{BASE_URL}/uapi/overseas-stock/v1/trading/order",
        headers=_headers(tr_id),
        json={
            "CANO":          acc_no,
            "ACNT_PRDT_CD":  acc_suffix,
            "OVRS_EXCG_CD":  exchange,
            "PDNO":          ticker,
            "ORD_DVSN":      "00",
            "ORD_QTY":       str(quantity),
            "OVRS_ORD_UNPR": limit_price,
        },
        timeout=10,
    )
    res.raise_for_status()
    return res.json()


def _safe_float(v) -> float | None:
    try:
        f = float(v)
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None


def calculate_quantity(max_amount: int, price: float) -> int:
    if price <= 0:
        return 0
    return int(max_amount // price)


def buy_market_order(ticker: str, quantity: int) -> dict:
    if quantity <= 0:
        return {"error": "수량이 0이하"}
    acc_no, acc_suffix = (ACCOUNT_NO.split("-") + [ACCOUNT_SUFFIX or "01"])[:2]
    tr_id = "VTTC0802U" if IS_MOCK else "TTTC0802U"
    res = requests.post(
        f"{BASE_URL}/uapi/domestic-stock/v1/trading/order-cash",
        headers=_headers(tr_id),
        json={
            "CANO": acc_no,
            "ACNT_PRDT_CD": acc_suffix,
            "PDNO": ticker,
            "ORD_DVSN": "01",
            "ORD_QTY": str(quantity),
            "ORD_UNPR": "0",
        },
        timeout=10,
    )
    res.raise_for_status()
    return res.json()


def sell_market_order(ticker: str, quantity: int) -> dict:
    if quantity <= 0:
        return {"error": "수량이 0이하"}
    acc_no, acc_suffix = (ACCOUNT_NO.split("-") + [ACCOUNT_SUFFIX or "01"])[:2]
    tr_id = "VTTC0801U" if IS_MOCK else "TTTC0801U"
    res = requests.post(
        f"{BASE_URL}/uapi/domestic-stock/v1/trading/order-cash",
        headers=_headers(tr_id),
        json={
            "CANO": acc_no,
            "ACNT_PRDT_CD": acc_suffix,
            "PDNO": ticker,
            "ORD_DVSN": "01",
            "ORD_QTY": str(quantity),
            "ORD_UNPR": "0",
        },
        timeout=10,
    )
    res.raise_for_status()
    return res.json()


def get_holdings() -> list:
    acc_no, acc_suffix = (ACCOUNT_NO.split("-") + [ACCOUNT_SUFFIX or "01"])[:2]
    tr_id = "VTTC8434R" if IS_MOCK else "TTTC8434R"
    res = requests.get(
        f"{BASE_URL}/uapi/domestic-stock/v1/trading/inquire-balance",
        headers=_headers(tr_id),
        params={
            "CANO": acc_no,
            "ACNT_PRDT_CD": acc_suffix,
            "AFHR_FLPR_YN": "N",
            "OFL_YN": "",
            "INQR_DVSN": "02",
            "UNPR_DVSN": "01",
            "FUND_STTL_ICLD_YN": "N",
            "FNCG_AMT_AUTO_RDPT_YN": "N",
            "PRCS_DVSN": "01",
            "CTX_AREA_FK100": "",
            "CTX_AREA_NK100": "",
        },
        timeout=10,
    )
    res.raise_for_status()
    output = res.json().get("output1", [])
    return [
        {
            "ticker": h["pdno"],
            "name": h["prdt_name"],
            "quantity": int(h["hldg_qty"]),
            "avg_price": float(h["pchs_avg_pric"]),
            "current_price": float(h["prpr"]),
            "pnl_pct": float(h["evlu_pfls_rt"]),
        }
        for h in output
        if int(h.get("hldg_qty", 0)) > 0
    ]

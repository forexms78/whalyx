import os
from datetime import datetime, timedelta

import requests

APP_KEY = os.getenv("KIS_APP_KEY", "")
APP_SECRET = os.getenv("KIS_APP_SECRET", "")
ACCOUNT_NO = os.getenv("KIS_ACCOUNT_NO", "")
IS_MOCK = os.getenv("KIS_MOCK", "true").lower() == "true"

BASE_URL = (
    "https://openapivts.koreainvestment.com:29443" if IS_MOCK
    else "https://openapi.koreainvestment.com:9443"
)

_token_cache: dict = {"token": None, "expires_at": None}


def get_access_token() -> str:
    now = datetime.now()
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


def get_daily_prices(ticker: str, days: int = 30) -> list[float]:
    """일별 종가 리스트 (최신순) — KIS 주식 기간별 시세"""
    end = datetime.now().strftime("%Y%m%d")
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
    acc_no, acc_suffix = (ACCOUNT_NO.split("-") + ["01"])[:2]
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
    acc_no, acc_suffix = (ACCOUNT_NO.split("-") + ["01"])[:2]
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
    acc_no, acc_suffix = (ACCOUNT_NO.split("-") + ["01"])[:2]
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

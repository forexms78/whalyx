"""
외국인 투자자 매매 데이터 — 네이버 금융(스크래핑) + KIS Open API 결합

데이터 소스:
  - 시장 외국인 순매수/순매도 종목 TOP (KOSPI/KOSDAQ)
      → 네이버 금융 iframe URL (sise_deal_rank_iframe)
        무인증, 1요청, KRX 가공 데이터
  - 특정 종목 외국인 일별 매매 추이
      → KIS Open API `/quotations/inquire-investor` (TR_ID: FHKST01010900)

호출 비용:
  - 네이버: ~1초/요청. 장 마감 후 1회만 (스케줄러). 화면은 Supabase 캐시 read-only.
  - KIS: 종목당 ~1-2초. /foreign-flow/{ticker} 엔드포인트가 직접 호출 + 5분 DB 캐시.

주의: 네이버 페이지 구조 변경 시 파싱 깨짐 → except로 빈 리스트 반환.
"""
import logging
import re
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_KST = ZoneInfo("Asia/Seoul")
_NAVER_BASE = "https://finance.naver.com"
_NAVER_MOBILE_BASE = "https://m.stock.naver.com"
_NAVER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Whalyx/2.6 +https://whalyx.vercel.app)",
    "Referer": "https://finance.naver.com/sise/",
}
_NAVER_MOBILE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; Whalyx/2.6 +https://whalyx.vercel.app)",
    "Referer": "https://m.stock.naver.com/",
}

# 네이버 sosok 코드: 01=KOSPI, 02=KOSDAQ
# 네이버 investor_gubun: 9000=외국인, 1000=기관
_SOSOK = {"KOSPI": "01", "KOSDAQ": "02"}


def _to_int(s: str) -> int:
    """'203,881' → 203881 / '-12,345' → -12345 / '' → 0"""
    if not s:
        return 0
    cleaned = re.sub(r"[^\d\-]", "", s)
    try:
        return int(cleaned) if cleaned and cleaned != "-" else 0
    except ValueError:
        return 0


def _fetch_naver_top(market: str, side: str, limit: int = 20) -> list:
    """네이버 외국인 매매 상위 iframe 파싱.

    Args:
        market: "KOSPI" 또는 "KOSDAQ"
        side:   "buy"  → 외국인 순매수 상위
                "sell" → 외국인 순매도 상위
    """
    sosok = _SOSOK.get(market.upper())
    if not sosok:
        return []

    url = (
        f"{_NAVER_BASE}/sise/sise_deal_rank_iframe.naver"
        f"?sosok={sosok}&investor_gubun=9000&type={side}"
    )
    try:
        res = requests.get(url, headers=_NAVER_HEADERS, timeout=10)
        res.encoding = "euc-kr"
        if res.status_code != 200:
            logger.warning(f"[foreign_flow] 네이버 {market} {side} status={res.status_code}")
            return []

        soup = BeautifulSoup(res.text, "html.parser")
        # 첫 번째 테이블 = 외국인 (두 번째 = 기관, 우리 관심 X)
        table = soup.select_one("table")
        if not table:
            return []

        result = []
        for tr in table.select("tr")[1:]:  # 헤더 스킵
            tds = tr.select("td")
            if len(tds) < 4:
                continue
            name = tds[0].get_text(strip=True)
            if not name:
                continue
            # 종목 링크에서 ticker 추출 (없을 수도 있음)
            ticker = ""
            a = tds[0].find("a", href=True)
            if a:
                m = re.search(r"code=(\d{6})", a["href"])
                if m:
                    ticker = m.group(1)
            result.append({
                "ticker":               ticker,
                "name":                 name,
                "net_buy_volume":       _to_int(tds[1].get_text(strip=True)),  # 단위: 천주
                "net_buy_value_mil":    _to_int(tds[2].get_text(strip=True)),  # 단위: 백만원
                "today_volume":         _to_int(tds[3].get_text(strip=True)),
            })
            if len(result) >= limit:
                break
        return result
    except Exception as e:
        logger.error(f"[foreign_flow] 네이버 {market} {side} 파싱 실패: {e}")
        return []


def get_top_foreign_buyers(market: str = "KOSPI", limit: int = 20) -> list:
    """외국인 순매수 상위 종목 (당일 기준, 네이버 노출 시점 기준)."""
    return _fetch_naver_top(market, "buy", limit)


def get_top_foreign_sellers(market: str = "KOSPI", limit: int = 20) -> list:
    """외국인 순매도 상위 종목 (당일 기준)."""
    return _fetch_naver_top(market, "sell", limit)


def get_market_deal_trend_today(market: str = "KOSPI") -> dict:
    """시장 전체 외국인·기관·개인 당일 매매 합계 (네이버 모바일 integration API).

    네이버는 일별 시계열 API를 노출하지 않으므로,
    스케줄러가 매일 KST 16:30+17:30 호출 → history에 누적 저장한다.

    Returns:
        {"bizdate": "2026-05-15", "personal": 72286, "foreign": -56043, "institutional": -17331}
        (단위: 백만원, 음수 = 순매도)
    """
    code = market.upper()
    if code not in ("KOSPI", "KOSDAQ"):
        return {}
    try:
        res = requests.get(
            f"{_NAVER_MOBILE_BASE}/api/index/{code}/integration",
            headers=_NAVER_MOBILE_HEADERS,
            timeout=10,
        )
        res.raise_for_status()
        info = (res.json() or {}).get("dealTrendInfo") or {}
        if not info:
            return {}
        bizdate_raw = info.get("bizdate", "")
        date_str = (
            f"{bizdate_raw[:4]}-{bizdate_raw[4:6]}-{bizdate_raw[6:]}"
            if len(bizdate_raw) == 8 else bizdate_raw
        )
        return {
            "bizdate":       date_str,
            "personal":      _to_int(info.get("personalValue", "0")),
            "foreign":       _to_int(info.get("foreignValue", "0")),
            "institutional": _to_int(info.get("institutionalValue", "0")),
        }
    except Exception as e:
        logger.error(f"[foreign_flow] {code} 시장합계 조회 실패: {e}")
        return {}


def build_foreign_flow_snapshot() -> dict:
    """스케줄러용 단일 스냅샷 — 종목 TOP + 시장 합계(당일).

    market_history는 스케줄러가 기존 캐시와 머지해서 채운다 (이 함수는 당일분만).
    """
    return {
        "top_buyers": {
            "kospi":  get_top_foreign_buyers("KOSPI",  limit=20),
            "kosdaq": get_top_foreign_buyers("KOSDAQ", limit=20),
        },
        "top_sellers": {
            "kospi":  get_top_foreign_sellers("KOSPI",  limit=20),
            "kosdaq": get_top_foreign_sellers("KOSDAQ", limit=20),
        },
        "market_today": {
            "kospi":  get_market_deal_trend_today("KOSPI"),
            "kosdaq": get_market_deal_trend_today("KOSDAQ"),
        },
        "updated_at": datetime.now(_KST).isoformat(),
        "source": {"top": "naver_iframe", "market": "naver_mobile"},
    }


# ── 종목별 외국인 매매 추이 (KIS Open API) ─────────────────────────────────────

def get_foreign_flow_by_ticker(ticker: str) -> dict:
    """특정 종목의 외국인·기관 일별 매매 추이 (최근 30영업일).

    KIS Open API `inquire-investor` (TR_ID: FHKST01010900).
    output[]: 일자별 외국인/기관/개인 매수/매도/순매수 (수량 단위: 주, 금액 단위: 천원)
    """
    from backend.services.kis_trader import BASE_URL, _headers

    ticker = (ticker or "").strip()
    if not re.fullmatch(r"\d{6}", ticker):
        return {"error": "유효한 6자리 종목코드 필요", "ticker": ticker}

    try:
        res = requests.get(
            f"{BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-investor",
            headers=_headers("FHKST01010900"),
            params={"fid_cond_mrkt_div_code": "J", "fid_input_iscd": ticker},
            timeout=10,
        )
        res.raise_for_status()
        body = res.json()
        rows = body.get("output", []) or []

        flow = []
        for r in rows:
            date_raw = r.get("stck_bsop_date") or ""
            if len(date_raw) != 8:
                continue
            flow.append({
                "date":            f"{date_raw[:4]}-{date_raw[4:6]}-{date_raw[6:]}",
                "close":           _to_int(r.get("stck_clpr", "0")),
                "change":          _to_int(r.get("prdy_vrss", "0")),
                "foreign_net":     _to_int(r.get("frgn_ntby_qty", "0")),     # 외국인 순매수 수량(주)
                "foreign_net_val": _to_int(r.get("frgn_ntby_tr_pbmn", "0")), # 외국인 순매수 금액(천원)
                "inst_net":        _to_int(r.get("orgn_ntby_qty", "0")),     # 기관 순매수 수량
                "inst_net_val":    _to_int(r.get("orgn_ntby_tr_pbmn", "0")), # 기관 순매수 금액
                "indiv_net":       _to_int(r.get("prsn_ntby_qty", "0")),     # 개인 순매수 수량
                "indiv_net_val":   _to_int(r.get("prsn_ntby_tr_pbmn", "0")), # 개인 순매수 금액
            })

        return {
            "ticker":     ticker,
            "flow":       flow,
            "updated_at": datetime.now(_KST).isoformat(),
            "source":     "kis_open_api",
        }
    except Exception as e:
        logger.error(f"[foreign_flow] KIS 종목별({ticker}) 조회 실패: {e}")
        return {"error": str(e), "ticker": ticker}

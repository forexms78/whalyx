import requests
import time
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
import yfinance as yf

load_dotenv()

BOK_API_KEY = os.getenv("BOK_API_KEY", "")
BOK_BASE = "https://ecos.bok.or.kr/api/StatisticSearch"

_cache: dict = {}
CACHE_TTL = 3600        # 금리 데이터: 1시간
FX_CACHE_TTL = 300      # 환율: 5분 (장중 실시간 반영)

_session = requests.Session()
_session.headers.update({"User-Agent": "Mozilla/5.0"})


def _get_bok_rows(stat_code: str, item_code: str, cycle: str = "D", count: int = 5) -> list[float]:
    """한국은행 ECOS API에서 최근 N개 값 조회 (D=일별)"""
    cache_key = f"{stat_code}_{item_code}_rows{count}"
    cached = _cache.get(cache_key)
    if cached and time.time() - cached[1] < CACHE_TTL:
        return cached[0]

    try:
        end_date = datetime.today().strftime("%Y%m%d")
        start_date = (datetime.today() - timedelta(days=30)).strftime("%Y%m%d")
        url = (
            f"{BOK_BASE}/{BOK_API_KEY}/json/kr/1/{count + 10}"
            f"/{stat_code}/{cycle}/{start_date}/{end_date}/{item_code}"
        )
        r = _session.get(url, timeout=8)
        r.raise_for_status()
        data = r.json()
        rows = data.get("StatisticSearch", {}).get("row", [])
        values = [float(row["DATA_VALUE"]) for row in rows if row.get("DATA_VALUE")]
        if values:
            _cache[cache_key] = (values, time.time())
        return values
    except Exception:
        return []


def _get_bok(stat_code: str, item_code: str, cycle: str = "D") -> float | None:
    rows = _get_bok_rows(stat_code, item_code, cycle, count=5)
    return rows[-1] if rows else None


def _get_realtime_usd_krw() -> tuple[float | None, float | None]:
    """yfinance KRW=X로 실시간 원달러 환율 조회 (5분 캐시)"""
    cache_key = "usd_krw_realtime"
    cached = _cache.get(cache_key)
    if cached and time.time() - cached[1] < FX_CACHE_TTL:
        return cached[0]

    try:
        t = yf.Ticker("KRW=X")
        hist = t.history(period="2d", interval="1h")
        if not hist.empty:
            closes = hist["Close"].tolist()
            current = round(float(closes[-1]), 2)
            change_1d = None
            # 전일 대비: 24개 봉(1h * 24) 이상이면 24봉 이전 값 사용
            if len(closes) >= 24:
                prev = closes[-24]
                change_1d = round((current - prev) / prev * 100, 2)
            elif len(closes) >= 2:
                change_1d = round((closes[-1] - closes[-2]) / closes[-2] * 100, 2)
            result = (current, change_1d)
            _cache[cache_key] = (result, time.time())
            return result
    except Exception:
        pass

    # BOK 폴백 (전일 마감 기준)
    try:
        krw_rows = _get_bok_rows("731Y001", "0000001", "D", count=5)
        if krw_rows:
            current = krw_rows[-1]
            change_1d = None
            if len(krw_rows) >= 2:
                change_1d = round((krw_rows[-1] - krw_rows[-2]) / krw_rows[-2] * 100, 2)
            return (current, change_1d)
    except Exception:
        pass

    return (None, None)


def get_korea_rates() -> dict:
    """한국 주요 금리 및 환율 데이터 반환"""
    # 한국은행 기준금리: 722Y001 / 0101000 (D 일별)
    base_rate = _get_bok("722Y001", "0101000", "D")
    # 국고채 3년: 817Y002 / 010200000
    treasury_3y = _get_bok("817Y002", "010200000", "D")
    # 국고채 10년: 817Y002 / 010210000
    treasury_10y = _get_bok("817Y002", "010210000", "D")
    # CD 91일물: 817Y002 / 010502000
    cd_rate = _get_bok("817Y002", "010502000", "D")
    # 원/달러 환율 — yfinance KRW=X 실시간 (장중 반영), BOK는 폴백
    usd_krw, usd_krw_change_1d = _get_realtime_usd_krw()

    return {
        "base_rate":         base_rate,          # 기준금리 (연%)
        "treasury_3y":       treasury_3y,        # 국고채 3년 (연%)
        "treasury_10y":      treasury_10y,       # 국고채 10년 (연%)
        "cd_rate":           cd_rate,            # CD 91일 (연%)
        "usd_krw":           usd_krw,            # 원/달러 환율 (원)
        "usd_krw_change_1d": usd_krw_change_1d,  # 전일 대비 변동률 (%)
        "updated_at":        datetime.now().isoformat(),
    }

"""
DART(금융감독원 전자공시시스템) API 서비스

기능:
  1. corp_code 매핑: 티커 → DART 고유번호 (Supabase dart_corp_codes)
  2. 재무 데이터: ROE·부채비율·유동비율·매출성장·영업이익성장
  3. 긴급차단 공시 체크: 유상증자·전환사채·신주인수권부사채
"""
import io
import os
import zipfile
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from backend.services.db_cache import _get_client as _sb, db_get, db_set
from backend.services import redis_cache

_KST = ZoneInfo("Asia/Seoul")
_API_KEY = os.getenv("DART_API_KEY", "")
_BASE = "https://opendart.fss.or.kr/api"

EMERGENCY_KEYWORDS = ["유상증자", "전환사채", "신주인수권부사채"]


# ── corp_code 매핑 ────────────────────────────────────────────────────────────

def build_corp_code_table() -> int:
    """DART 전체기업 고유번호 XML 다운로드 → Supabase dart_corp_codes 갱신.
    반환: 저장된 상장사 수 (stock_code 있는 것만)"""
    if not _API_KEY:
        print("[dart] DART_API_KEY 없음 — corp_code 빌드 스킵")
        return 0
    try:
        res = requests.get(
            f"{_BASE}/corpCode.xml",
            params={"crtfc_key": _API_KEY},
            timeout=60,
        )
        res.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(res.content)) as z:
            xml_bytes = z.read("CORPCODE.xml")
        root = ET.fromstring(xml_bytes)
        rows = []
        for item in root.findall("list"):
            stock_code = (item.findtext("stock_code") or "").strip()
            corp_code  = (item.findtext("corp_code")  or "").strip()
            corp_name  = (item.findtext("corp_name")  or "").strip()
            if stock_code and corp_code:
                rows.append({
                    "ticker":     stock_code,
                    "corp_code":  corp_code,
                    "corp_name":  corp_name,
                    "updated_at": datetime.now(_KST).isoformat(),
                })
        if rows:
            sb = _sb()
            for i in range(0, len(rows), 1000):
                sb.table("dart_corp_codes").upsert(rows[i:i+1000], on_conflict="ticker").execute()
        print(f"[dart] corp_code 테이블 갱신 완료: {len(rows)}개 상장사")
        return len(rows)
    except Exception as e:
        print(f"[dart] corp_code 테이블 갱신 실패: {e}")
        return 0


def get_corp_code(ticker: str) -> str | None:
    """티커 → DART corp_code. DB에 없으면 None."""
    try:
        res = _sb().table("dart_corp_codes").select("corp_code").eq("ticker", ticker).execute()
        if res.data:
            return res.data[0]["corp_code"]
    except Exception:
        pass
    return None


# ── 재무 데이터 ───────────────────────────────────────────────────────────────

def _find_amount(items: list[dict], keyword: str, field: str = "thstrm_amount") -> float | None:
    """items에서 account_nm에 keyword가 포함된 첫 항목의 금액(원) 반환."""
    for it in items:
        if keyword in (it.get("account_nm") or ""):
            raw = (it.get(field) or "").replace(",", "").strip()
            try:
                return float(raw)
            except ValueError:
                pass
    return None


def get_kr_financials(corp_code: str) -> dict:
    """DART fnlttSinglAcnt → ROE·부채비율·유동비율·매출성장·영업이익성장.
    Supabase api_cache 6시간 TTL."""
    cache_key = f"dart_fin:{corp_code}"
    cached = db_get(cache_key, ttl=21600)
    if cached is not None:
        return cached

    result: dict = {}
    if not _API_KEY:
        return result

    year = datetime.now(_KST).year
    items_cur: list[dict] = []
    for bsns_year in (year - 1, year - 2):
        try:
            res = requests.get(
                f"{_BASE}/fnlttSinglAcnt.json",
                params={
                    "crtfc_key":  _API_KEY,
                    "corp_code":  corp_code,
                    "bsns_year":  str(bsns_year),
                    "reprt_code": "11011",
                },
                timeout=10,
            )
            data = res.json()
            if data.get("status") == "000" and data.get("list"):
                items_cur = data["list"]
                break
        except Exception:
            pass

    if not items_cur:
        db_set(cache_key, result)
        return result

    net_income  = _find_amount(items_cur, "당기순이익")
    equity      = _find_amount(items_cur, "자본총계")
    debt        = _find_amount(items_cur, "부채총계")
    current_a   = _find_amount(items_cur, "유동자산")
    current_l   = _find_amount(items_cur, "유동부채")
    revenue_cur = _find_amount(items_cur, "매출액")
    op_income_c = _find_amount(items_cur, "영업이익")
    revenue_prv = _find_amount(items_cur, "매출액",  "frmtrm_amount")
    op_income_p = _find_amount(items_cur, "영업이익", "frmtrm_amount")

    if net_income is not None and equity and equity > 0:
        result["roe"] = net_income / equity

    if debt is not None and equity and equity > 0:
        result["debt_to_equity"] = (debt / equity) * 100

    if current_a is not None and current_l and current_l > 0:
        result["current_ratio"] = current_a / current_l

    if revenue_cur and revenue_prv and revenue_prv > 0:
        result["revenue_growth"] = (revenue_cur - revenue_prv) / abs(revenue_prv)

    if op_income_c is not None and op_income_p is not None and op_income_p > 0:
        result["earnings_growth"] = (op_income_c - op_income_p) / abs(op_income_p)

    db_set(cache_key, result)
    return result


# ── 긴급차단 공시 ─────────────────────────────────────────────────────────────

def check_emergency_block(corp_code: str) -> tuple[bool, str]:
    """최근 3일 주요사항보고서(C)에서 긴급차단 키워드 탐색.
    Redis 4시간 캐시. 반환: (차단여부, 공시제목)"""
    cache_key = f"dart_block:{corp_code}"
    cached = redis_cache.get(cache_key)
    if cached is not None:
        return bool(cached.get("blocked")), cached.get("title", "")

    if not _API_KEY:
        redis_cache.set(cache_key, {"blocked": False, "title": ""}, ttl=14400)
        return False, ""

    try:
        now = datetime.now(_KST)
        bgn = (now - timedelta(days=3)).strftime("%Y%m%d")
        end = now.strftime("%Y%m%d")
        res = requests.get(
            f"{_BASE}/list.json",
            params={
                "crtfc_key":  _API_KEY,
                "corp_code":  corp_code,
                "pblntf_ty":  "C",
                "bgn_de":     bgn,
                "end_de":     end,
                "page_count": "10",
            },
            timeout=8,
        )
        data = res.json()
        for item in (data.get("list") or []):
            title = item.get("report_nm", "")
            for kw in EMERGENCY_KEYWORDS:
                if kw in title:
                    payload = {"blocked": True, "title": title}
                    redis_cache.set(cache_key, payload, ttl=14400)
                    return True, title
    except Exception as e:
        print(f"[dart] 공시 조회 실패 {corp_code}: {e}")

    redis_cache.set(cache_key, {"blocked": False, "title": ""}, ttl=14400)
    return False, ""

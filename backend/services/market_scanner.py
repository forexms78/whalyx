"""
한국 주식 시장 전종목 골든크로스 프리스캐너

[흐름]
1. build_kr_universe(): KOSPI+KOSDAQ 전종목 → Redis(`kr_universe`, 7d) + Supabase(best-effort)
2. prescan_golden_cross(): Redis 우선 → 비어있으면 즉시 build 후 재조회 → 시총 상위 top_n 종목 yfinance 배치 → MA5/MA20 후보 → Redis 8h 캐시
3. get_scan_candidates(): Redis 후보 반환 → _buy_stocks 우선 스캔
"""
from datetime import datetime
from zoneinfo import ZoneInfo

from backend.services import redis_cache

_KST = ZoneInfo("Asia/Seoul")
_UNIVERSE_KEY = "kr_universe"
_UNIVERSE_TTL = 7 * 86400  # 7일


def build_kr_universe() -> int:
    """KOSPI + KOSDAQ 전종목 리스트 → Redis 저장 + Supabase upsert(best-effort). 저장 건수 반환."""
    try:
        import FinanceDataReader as fdr

        rows: list[dict] = []
        for market_type in ("KOSPI", "KOSDAQ"):
            try:
                df = fdr.StockListing(market_type)
            except Exception as e:
                print(f"[scanner] {market_type} 조회 실패: {e}")
                continue

            for _, row in df.iterrows():
                code = str(row.get("Code") or row.get("Symbol") or "").strip()
                name = str(row.get("Name") or "").strip()
                marcap = float(row.get("Marcap") or row.get("Cap") or 0)
                if not code or not name:
                    continue
                if len(code) != 6 or not code.isdigit():
                    continue
                rows.append({
                    "ticker":      code,
                    "name":        name,
                    "market_type": market_type,
                    "marcap":      marcap,
                    "updated_at":  datetime.now(_KST).isoformat(),
                })

        if not rows:
            print("[scanner] build_kr_universe: 조회된 종목 없음")
            return 0

        redis_cache.set(_UNIVERSE_KEY, rows, ttl=_UNIVERSE_TTL)
        print(f"[scanner] kr_universe Redis 저장: {len(rows)}종목")

        # Supabase 백업 저장 (테이블 없거나 권한 없어도 무시)
        try:
            from backend.services.db_cache import _get_client as _sb
            client = _sb()
            if client:
                for i in range(0, len(rows), 500):
                    client.table("market_universe").upsert(rows[i:i+500], on_conflict="ticker").execute()
                print(f"[scanner] market_universe Supabase 백업 완료")
        except Exception as e:
            print(f"[scanner] Supabase 백업 스킵: {str(e)[:80]}")

        return len(rows)

    except ImportError:
        print("[scanner] FinanceDataReader 미설치 — pip install finance-datareader")
        return 0
    except Exception as e:
        print(f"[scanner] build_kr_universe 실패: {e}")
        return 0


def _load_universe() -> list[dict]:
    """Redis → Supabase → 즉시 빌드 순서로 universe 조회."""
    rows = redis_cache.get(_UNIVERSE_KEY)
    if isinstance(rows, list) and rows:
        return rows

    # Supabase 폴백
    try:
        from backend.services.db_cache import _get_client as _sb
        client = _sb()
        if client:
            res = client.table("market_universe").select("ticker, name, marcap").execute()
            rows = res.data or []
            if rows:
                redis_cache.set(_UNIVERSE_KEY, rows, ttl=_UNIVERSE_TTL)
                return rows
    except Exception:
        pass

    # 즉시 빌드
    print("[scanner] universe 비어있음 → 즉시 build_kr_universe 실행")
    if build_kr_universe() > 0:
        rows = redis_cache.get(_UNIVERSE_KEY)
        if isinstance(rows, list):
            return rows
    return []


def prescan_golden_cross(top_n: int = 1500) -> int:
    """
    전종목 일봉 yfinance 배치 다운로드 → MA5/MA20 골든크로스 or 근접 후보 추출 → Redis 저장.
    near_cross: MA5가 MA20의 97% 이상 ~ 105% 미만 (돌파 직전/직후)
    Returns: 후보 종목 수
    """
    try:
        import yfinance as yf

        rows = _load_universe()
        if not rows:
            print("[scanner] universe 로드 실패 — 프리스캔 중단")
            return 0

        # 시총 내림차순 상위 top_n
        rows.sort(key=lambda x: x.get("marcap") or 0, reverse=True)
        rows = rows[:top_n]

        tickers_yf = [f"{r['ticker']}.KS" for r in rows]
        ticker_map = {f"{r['ticker']}.KS": r for r in rows}

        print(f"[scanner] {len(tickers_yf)}종목 배치 다운로드 중...")
        data = yf.download(
            tickers_yf,
            period="35d",
            auto_adjust=True,
            group_by="ticker",
            threads=True,
            progress=False,
        )

        candidates: list[dict] = []

        for yf_ticker in tickers_yf:
            try:
                if len(tickers_yf) == 1:
                    closes = data["Close"].dropna().tolist()[::-1]
                else:
                    closes = data[yf_ticker]["Close"].dropna().tolist()[::-1]

                if len(closes) < 22:
                    continue

                ma5_now   = sum(closes[:5])   / 5
                ma20_now  = sum(closes[:20])  / 20
                ma5_prev  = sum(closes[1:6])  / 5
                ma20_prev = sum(closes[1:21]) / 20

                golden_cross = ma5_prev <= ma20_prev and ma5_now > ma20_now
                near_cross   = (
                    not golden_cross
                    and ma5_now >= ma20_now * 0.97
                    and ma5_now < ma20_now * 1.05
                )

                if golden_cross or near_cross:
                    info   = ticker_map.get(yf_ticker, {})
                    ticker = yf_ticker.replace(".KS", "")
                    candidates.append({
                        "ticker":       ticker,
                        "name":         info.get("name", ticker),
                        "market":       "KR",
                        "ma5":          round(ma5_now, 2),
                        "ma20":         round(ma20_now, 2),
                        "golden_cross": golden_cross,
                        "near_cross":   near_cross,
                    })
            except Exception:
                continue

        redis_cache.set("scan_candidates", candidates, ttl=28800)  # 8시간
        print(f"[scanner] 골든크로스 후보: {len(candidates)}종목 / {len(tickers_yf)}종목 스캔")
        return len(candidates)

    except Exception as e:
        print(f"[scanner] prescan_golden_cross 실패: {e}")
        return 0


def get_scan_candidates() -> list[dict]:
    """Redis 후보 반환. 없으면 빈 리스트."""
    try:
        result = redis_cache.get("scan_candidates")
        return result if isinstance(result, list) else []
    except Exception:
        return []

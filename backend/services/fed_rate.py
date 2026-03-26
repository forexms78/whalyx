"""뉴욕 연준 공개 API — EFFR(실효연방기금금리) 실시간 조회"""
import time
import requests

_cache: dict = {"rate": None, "ts": 0}
_TTL = 3600  # 1시간 캐시


def get_fed_rate() -> float:
    """NY Fed API에서 최신 EFFR 반환. 실패 시 타겟 상단(3.75) 폴백."""
    now = time.time()
    if _cache["rate"] is not None and now - _cache["ts"] < _TTL:
        return _cache["rate"]

    try:
        resp = requests.get(
            "https://markets.newyorkfed.org/api/rates/all/latest.json",
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        rates = data.get("refRates", [])
        effr = next((r for r in rates if r.get("type") == "EFFR"), None)
        if effr:
            rate = float(effr.get("percentRate", 3.75))
            _cache["rate"] = rate
            _cache["ts"] = now
            return rate
    except Exception:
        pass

    # 폴백: 타겟 레인지 상단 값
    return _cache["rate"] if _cache["rate"] is not None else 3.75

"""
Redis 캐시 래퍼 — REDIS_URL 없으면 인메모리 dict로 자동 폴백
"""
import json
import os
import time
from typing import Any

_mem: dict[str, tuple[Any, float]] = {}  # key → (value, expires_at)

try:
    import redis as _redis
    _r: "_redis.Redis | None" = None

    def _client():
        global _r
        if _r is None:
            url = os.getenv("REDIS_URL", "")
            if url:
                _r = _redis.from_url(url, decode_responses=True, socket_connect_timeout=3)
        return _r
except ImportError:
    def _client():
        return None


def get(key: str) -> Any:
    r = _client()
    if r:
        try:
            v = r.get(key)
            return json.loads(v) if v is not None else None
        except Exception:
            pass
    entry = _mem.get(key)
    if entry and time.time() < entry[1]:
        return entry[0]
    return None


def set(key: str, value: Any, ttl: int = 300) -> None:
    r = _client()
    if r:
        try:
            r.setex(key, ttl, json.dumps(value, default=str))
            return
        except Exception:
            pass
    _mem[key] = (value, time.time() + ttl)


def delete(key: str) -> None:
    r = _client()
    if r:
        try:
            r.delete(key)
        except Exception:
            pass
    _mem.pop(key, None)

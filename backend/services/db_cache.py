"""Supabase 영속 캐시 — Railway 재시작 후에도 캐시 유지

테이블 생성 SQL (Supabase 대시보드 → SQL Editor에서 1회 실행):
  CREATE TABLE IF NOT EXISTS api_cache (
    key        TEXT PRIMARY KEY,
    data       JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

사용법:
  from backend.services.db_cache import db_get, db_set

  cached = db_get("whale_signal", ttl=7200)
  if cached:
      return cached
  result = compute_heavy_thing()
  db_set("whale_signal", result)
  return result
"""

import os
import time
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        return None
    try:
        from supabase import create_client
        _client = create_client(url, key)
    except Exception:
        pass
    return _client


def db_get(key: str, ttl: int) -> dict | list | None:
    """Supabase api_cache 테이블에서 캐시 조회.
    TTL 이내이면 data 반환, 만료/없음/오류면 None."""
    client = _get_client()
    if not client:
        return None
    try:
        r = client.table("api_cache") \
            .select("data,updated_at") \
            .eq("key", key) \
            .maybe_single() \
            .execute()
        if not r.data:
            return None
        updated_str = r.data["updated_at"]
        # Supabase returns ISO format with +00:00 or Z
        updated_str = updated_str.replace("Z", "+00:00")
        updated_at = datetime.fromisoformat(updated_str)
        age = (datetime.now(timezone.utc) - updated_at).total_seconds()
        if age < ttl:
            return r.data["data"]
    except Exception:
        pass
    return None


def db_get_stale(key: str) -> dict | list | None:
    """TTL 무시하고 Supabase에 데이터가 있으면 무조건 반환.
    스케줄러가 신선도를 보장하므로 엔드포인트는 이 함수를 사용."""
    client = _get_client()
    if not client:
        return None
    try:
        r = client.table("api_cache") \
            .select("data") \
            .eq("key", key) \
            .maybe_single() \
            .execute()
        return r.data["data"] if r.data else None
    except Exception:
        return None


def db_set(key: str, data: dict | list) -> None:
    """Supabase api_cache 테이블에 캐시 저장 (upsert).
    실패해도 조용히 무시 — 메모리 캐시로 폴백."""
    client = _get_client()
    if not client:
        return
    try:
        client.table("api_cache").upsert({
            "key": key,
            "data": data,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception:
        pass

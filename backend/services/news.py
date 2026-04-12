import re
import time
import feedparser
import requests as _req
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote_plus
from email.utils import parsedate_to_datetime

_news_cache: dict[str, tuple[list[dict], float]] = {}
NEWS_CACHE_TTL    = 900  # 15분 — 검색 쿼리 캐시
HEADLINE_CACHE_TTL = 300  # 5분  — 헤드라인 RSS 캐시

_OG_CACHE: dict[str, tuple[str, float]] = {}  # url → (og_image_url, fetched_at)
_OG_CACHE_TTL = 3600  # OG 이미지 URL은 1시간 캐시

_OG_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
}

def _fetch_og_image(url: str) -> str:
    """기사 URL → og:image 추출 (Google News 리다이렉트 자동 추적, 1시간 캐시)"""
    if not url:
        return ""
    now = time.time()
    cached = _OG_CACHE.get(url)
    if cached and now - cached[1] < _OG_CACHE_TTL:
        return cached[0]
    try:
        r = _req.get(url, timeout=5, allow_redirects=True, headers=_OG_HEADERS)
        html = r.text

        # property="og:image" content="..." 순서
        m = re.search(r'property=["\']og:image["\'][^>]*content=["\']([^"\']+)', html, re.IGNORECASE)
        # content="..." property="og:image" 순서
        if not m:
            m = re.search(r'content=["\']([^"\']+)["\'][^>]*property=["\']og:image', html, re.IGNORECASE)
        # name="twitter:image" 폴백
        if not m:
            m = re.search(r'name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)', html, re.IGNORECASE)

        img = m.group(1).strip() if m else ""
        # HTML 엔티티 디코드 (&amp; → &)
        img = img.replace("&amp;", "&").replace("&quot;", '"')
        # data: URI 또는 너무 짧은 값 제외
        if img.startswith("data:") or len(img) < 15:
            img = ""
        _OG_CACHE[url] = (img, now)
        return img
    except Exception:
        _OG_CACHE[url] = ("", now)
        return ""


def enrich_with_og_images(items: list[dict], max_workers: int = 6) -> list[dict]:
    """RSS 이미지가 없는 뉴스에 OG 이미지를 병렬로 추가 (이미 있으면 스킵)"""
    needs = [(i, item) for i, item in enumerate(items) if not item.get("image_url")]
    if not needs:
        return items

    result = [dict(item) for item in items]
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_fetch_og_image, item["url"]): i for i, item in needs}
        for future in as_completed(futures, timeout=8):
            idx = futures[future]
            try:
                result[idx]["image_url"] = future.result()
            except Exception:
                pass
    return result

_BLOCKED_DOMAINS = {
    "pypi.org", "github.com", "npmjs.com", "stackoverflow.com",
    "readthedocs.io", "docs.python.org",
    "t.co", "reddit.com", "twitter.com", "x.com",
    "patreon.com", "substack.com", "discord.com", "telegram.org",
}

_PROMO_KEYWORDS = [
    "earn up to", "sign up", "join now", "get started", "trading platform",
    "exchange listing", "listed on", "now available on", "launch event",
    "exclusive offer", "limited time", "airdrop", "referral", "bonus",
    "sponsored", "advertisement", "press release",
]
_PROMO_SOURCES = {"prnewswire", "globenewswire", "businesswire", "accesswire"}


def _is_junk_url(url: str) -> bool:
    if not url:
        return True
    try:
        from urllib.parse import urlparse
        host = urlparse(url).netloc.lower().lstrip("www.")
        return any(host == d or host.endswith("." + d) for d in _BLOCKED_DOMAINS)
    except Exception:
        return False


def _parse_published(entry) -> str:
    try:
        return parsedate_to_datetime(entry.published).isoformat()
    except Exception:
        return ""


def _extract_image(entry) -> str:
    """feedparser 엔트리에서 이미지 URL 추출 (media:thumbnail → media:content → enclosure 순)"""
    try:
        thumbnails = getattr(entry, "media_thumbnail", None)
        if thumbnails:
            return thumbnails[0].get("url", "")
    except Exception:
        pass
    try:
        contents = getattr(entry, "media_content", None)
        if contents:
            for mc in contents:
                url = mc.get("url", "")
                if url and any(ext in url.lower() for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"]):
                    return url
    except Exception:
        pass
    try:
        enclosures = getattr(entry, "enclosures", None)
        if enclosures:
            for enc in enclosures:
                if enc.get("type", "").startswith("image/"):
                    return enc.get("url", "")
    except Exception:
        pass
    return ""


def _fetch_news(q: str, limit: int, hl: str = "en", gl: str = "US", ceid: str = "US:en") -> list[dict]:
    cache_key = f"{q}_{limit}_{hl}_{gl}"
    now = time.time()
    cached = _news_cache.get(cache_key)
    if cached and now - cached[1] < NEWS_CACHE_TTL:
        return cached[0]

    url = (
        f"https://news.google.com/rss/search?"
        f"q={quote_plus(q)}&hl={hl}&gl={gl}&ceid={ceid}"
    )

    try:
        feed = feedparser.parse(url)
        seen_urls: set[str] = set()
        seen_titles: set[str] = set()
        result = []

        for entry in feed.entries:
            title = entry.get("title", "")
            link = entry.get("link", "")
            source = entry.get("source", {}).get("title", "") if hasattr(entry.get("source", ""), "get") else ""
            description = entry.get("summary", "")

            if not title or "[Removed]" in title:
                continue
            if _is_junk_url(link):
                continue

            title_key = title[:40].lower()
            if link in seen_urls or title_key in seen_titles:
                continue

            # 홍보성 필터
            text = (title + " " + description).lower()
            if any(kw in text for kw in _PROMO_KEYWORDS):
                continue
            if any(s in source.lower() for s in _PROMO_SOURCES):
                continue

            seen_urls.add(link)
            seen_titles.add(title_key)
            result.append({
                "title": title,
                "description": description,
                "source": source,
                "published_at": _parse_published(entry),
                "url": link,
                "image_url": _extract_image(entry),
            })

            if len(result) >= limit:
                break

        _news_cache[cache_key] = (result, time.time())
        return result
    except Exception:
        return []


def fetch_investor_news(investor_name: str, limit: int = 6) -> list[dict]:
    for q in [f'"{investor_name}"', investor_name]:
        results = _fetch_news(q, limit)
        if results:
            return results
    return []


def fetch_stock_news(ticker: str, limit: int = 5) -> list[dict]:
    return _fetch_news(ticker, limit)


def _ko(q: str, limit: int) -> list[dict]:
    """한국어 Google News 검색 헬퍼"""
    return _fetch_news(q, limit, hl="ko", gl="KR", ceid="KR:ko")


def _en(q: str, limit: int) -> list[dict]:
    """영어 Google News 검색 헬퍼"""
    return _fetch_news(q, limit)


def _ko_then_en(ko_queries: list[str], en_queries: list[str], limit: int) -> list[dict]:
    """한국어 쿼리 우선 시도 → 결과 부족 시 영어 폴백"""
    for q in ko_queries:
        results = _ko(q, limit)
        if len(results) >= 3:  # 최소 3개 이상이어야 유효한 결과로 판단
            return results
    for q in en_queries:
        results = _en(q, limit)
        if results:
            return results
    return []


def fetch_crypto_news(limit: int = 8) -> list[dict]:
    return _ko_then_en(
        ko_queries=["비트코인 이더리움 암호화폐", "코인 가상화폐 투자"],
        en_queries=["bitcoin OR ethereum OR crypto cryptocurrency", "crypto"],
        limit=limit,
    )


def fetch_realestate_news(limit: int = 8) -> list[dict]:
    return _ko_then_en(
        ko_queries=["아파트 부동산 서울", "부동산 시세 매매", "한국 부동산"],
        en_queries=["Korea real estate housing market"],
        limit=limit,
    )


def fetch_commodity_news(limit: int = 8) -> list[dict]:
    return _ko_then_en(
        ko_queries=["금 은 구리 원유 원자재", "금값 유가 원자재 투자"],
        en_queries=["gold silver copper oil uranium lithium commodity", "commodity metals energy"],
        limit=limit,
    )


def fetch_bond_news(limit: int = 8) -> list[dict]:
    return _ko_then_en(
        ko_queries=["미국채 국채 금리 연준", "채권 금리 인하 인상"],
        en_queries=["treasury bonds yield interest rate Fed Federal Reserve", "bond yield treasury"],
        limit=limit,
    )


def fetch_stock_market_news(limit: int = 8) -> list[dict]:
    return _ko_then_en(
        ko_queries=["미국증시 나스닥 S&P500 관세", "뉴욕증시 월가 주식시장"],
        en_queries=["stock market S&P500 Nasdaq Wall Street tariff", "S&P500 stocks market Fed tariff"],
        limit=limit,
    )


def fetch_asia_market_news(limit: int = 6) -> list[dict]:
    return _ko_then_en(
        ko_queries=["코스피 코스닥 한국증시", "아시아증시 일본 중국"],
        en_queries=["Kospi Korea stock market", "Asian markets stocks"],
        limit=limit,
    )


def _fetch_rss_headlines(rss_url: str, ttl: float = HEADLINE_CACHE_TTL) -> list[dict]:
    """RSS URL에서 헤드라인 목록 파싱 (캐시 포함)"""
    cache_key = f"top_headlines_{rss_url}"
    now = time.time()
    cached = _news_cache.get(cache_key)
    if cached and now - cached[1] < ttl:
        return cached[0]
    try:
        feed = feedparser.parse(rss_url)
        # 채널 레벨 소스명 (entry에 없을 때 폴백)
        channel_title = getattr(feed.feed, "title", "") or ""
        entries = []
        for entry in feed.entries:
            title = entry.get("title", "")
            link = entry.get("link", "")
            # entry 레벨 source → 없으면 채널 타이틀
            src_obj = entry.get("source", "")
            source = (src_obj.get("title", "") if hasattr(src_obj, "get") else "") or channel_title
            if not title:
                continue
            entries.append({
                "title": title,
                "description": entry.get("summary", ""),
                "source": source,
                "published_at": _parse_published(entry),
                "url": link,
                "image_url": _extract_image(entry),
            })
        _news_cache[cache_key] = (entries, time.time())
        return entries
    except Exception:
        return []


def fetch_korean_headlines(limit: int = 15) -> list[dict]:
    """한국 주요 언론사 RSS 직접 수집 — 이미지 포함, 5분 캐시.
    Google News RSS는 이미지를 제공하지 않아 조선일보·동아일보 RSS를 직접 사용.
    카테고리 다양성 확보: 국제·정치·경제·사회 섞어서 반환.
    """
    # (RSS URL, 카테고리 레이블)
    rss_sources = [
        ("https://www.chosun.com/arc/outboundfeeds/rss/category/international/?outputType=xml", "국제"),
        ("https://rss.donga.com/economy.xml", "경제"),
        ("https://www.chosun.com/arc/outboundfeeds/rss/category/politics/?outputType=xml", "정치"),
        ("https://www.chosun.com/arc/outboundfeeds/rss/?outputType=xml", "종합"),
        ("https://rss.donga.com/total.xml", "종합"),
    ]

    seen_titles: set[str] = set()
    result: list[dict] = []

    for rss_url, category in rss_sources:
        for item in _fetch_rss_headlines(rss_url, ttl=HEADLINE_CACHE_TTL):
            # 이미지 없는 항목 먼저 제외 (이미지 있는 것 우선)
            title_key = item["title"][:40].lower()
            if title_key in seen_titles:
                continue
            seen_titles.add(title_key)
            result.append({**item, "category": item.get("category", category)})
        if len(result) >= limit:
            break

    # 이미지 있는 것 앞으로 정렬 후 limit
    with_img = [i for i in result if i.get("image_url")]
    without  = [i for i in result if not i.get("image_url")]
    return (with_img + without)[:limit]


def fetch_top_headlines(limit: int = 20) -> list[dict]:
    """Gemini 마켓 드라이버 분석용 헤드라인 — 텍스트만 필요, Google News 한국어 RSS"""
    rss_urls = [
        "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko",
        "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko",
        "https://news.google.com/rss/headlines/section/topic/WORLD?hl=ko&gl=KR&ceid=KR:ko",
    ]
    seen_titles: set[str] = set()
    result: list[dict] = []
    for url in rss_urls:
        for item in _fetch_rss_headlines(url, ttl=HEADLINE_CACHE_TTL):
            title_key = item["title"][:40].lower()
            if title_key not in seen_titles:
                seen_titles.add(title_key)
                result.append(item)
        if len(result) >= limit:
            break
    return result[:limit]


def fetch_korean_market_news(limit: int = 6) -> list[dict]:
    """한국 경제·투자 뉴스 (구글 뉴스 RSS 한국어판)"""
    queries = [
        ("주식 증시 코스피", "ko", "KR", "KR:ko"),
        ("부동산 아파트 투자", "ko", "KR", "KR:ko"),
        ("암호화폐 비트코인 이더리움", "ko", "KR", "KR:ko"),
        ("금리 한국은행 금융", "ko", "KR", "KR:ko"),
    ]
    seen_titles: set[str] = set()
    result: list[dict] = []
    for q, hl, gl, ceid in queries:
        items = _fetch_news(q, limit=4, hl=hl, gl=gl, ceid=ceid)
        for item in items:
            title_key = item["title"][:40].lower()
            if title_key not in seen_titles:
                seen_titles.add(title_key)
                result.append(item)
        if len(result) >= limit:
            break
    return result[:limit]


def fetch_market_news_all() -> dict[str, list[dict]]:
    raw: dict[str, list[dict]] = {
        "주식": fetch_stock_market_news(6),
        "코인": fetch_crypto_news(6),
        "부동산": fetch_realestate_news(5),
        "광물": fetch_commodity_news(5),
        "채권": fetch_bond_news(5),
        "한국": fetch_korean_market_news(6),
    }
    # 전체 기사 OG 이미지 일괄 병렬 보강
    all_items = [item for items in raw.values() for item in items]
    enriched = enrich_with_og_images(all_items, max_workers=8)

    # 카테고리별로 재분배
    idx = 0
    result: dict[str, list[dict]] = {}
    for cat, items in raw.items():
        n = len(items)
        result[cat] = enriched[idx:idx + n]
        idx += n
    return result

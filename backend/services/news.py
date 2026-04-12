import time
import feedparser
from urllib.parse import quote_plus
from email.utils import parsedate_to_datetime

_news_cache: dict[str, tuple[list[dict], float]] = {}
NEWS_CACHE_TTL = 900  # 15분

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


def fetch_crypto_news(limit: int = 8) -> list[dict]:
    results = _fetch_news("bitcoin OR ethereum OR crypto cryptocurrency", limit)
    if not results:
        results = _fetch_news("crypto", limit)
    return results


def fetch_realestate_news(limit: int = 8) -> list[dict]:
    queries = [
        "아파트 부동산 서울",
        "부동산 시세 매매",
        "한국 부동산",
    ]
    for q in queries:
        results = _fetch_news(q, limit, hl="ko", gl="KR", ceid="KR:ko")
        if results:
            return results
    return _fetch_news("Korea real estate housing market", limit)


def fetch_commodity_news(limit: int = 8) -> list[dict]:
    results = _fetch_news(
        "gold silver copper oil uranium lithium commodity",
        limit,
    )
    if not results:
        results = _fetch_news("commodity metals energy", limit)
    return results


def fetch_bond_news(limit: int = 8) -> list[dict]:
    results = _fetch_news(
        "treasury bonds yield interest rate Fed Federal Reserve",
        limit,
    )
    if not results:
        results = _fetch_news("bond yield treasury", limit)
    return results


def fetch_stock_market_news(limit: int = 8) -> list[dict]:
    queries = [
        "stock market S&P500 Nasdaq Wall Street tariff",
        "S&P500 stocks market Fed tariff",
        "stock market Wall Street",
    ]
    for q in queries:
        results = _fetch_news(q, limit)
        if results:
            return results
    return []


def fetch_asia_market_news(limit: int = 6) -> list[dict]:
    queries = [
        "Kospi Korea stock market",
        "Asian markets stocks",
        "Korea market stocks",
    ]
    for q in queries:
        results = _fetch_news(q, limit)
        if results:
            return results
    return []


def _fetch_rss_headlines(rss_url: str) -> list[dict]:
    """RSS URL에서 헤드라인 목록 파싱 (캐시 포함)"""
    cache_key = f"top_headlines_{rss_url}"
    now = time.time()
    cached = _news_cache.get(cache_key)
    if cached and now - cached[1] < NEWS_CACHE_TTL:
        return cached[0]
    try:
        feed = feedparser.parse(rss_url)
        entries = []
        for entry in feed.entries:
            title = entry.get("title", "")
            link = entry.get("link", "")
            source = entry.get("source", {}).get("title", "") if hasattr(entry.get("source", ""), "get") else ""
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


def fetch_top_headlines(limit: int = 20) -> list[dict]:
    """글로벌+한국 종합 헤드라인 — 한국 비즈니스 우선, 미국 글로벌 보완 (마켓 드라이버 분석용)"""
    rss_urls = [
        # 한국 비즈니스·경제 (우선 반영)
        "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko",
        "https://news.google.com/rss/headlines/section/topic/WORLD?hl=ko&gl=KR&ceid=KR:ko",
        # 글로벌 보완
        "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en&gl=US&ceid=US:en",
        "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en&gl=US&ceid=US:en",
    ]

    seen_titles: set[str] = set()
    result = []

    for url in rss_urls:
        for item in _fetch_rss_headlines(url):
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
    return {
        "주식": fetch_stock_market_news(6),
        "코인": fetch_crypto_news(6),
        "부동산": fetch_realestate_news(5),
        "광물": fetch_commodity_news(5),
        "채권": fetch_bond_news(5),
        "한국": fetch_korean_market_news(6),
    }

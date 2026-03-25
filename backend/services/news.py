import os
import requests
from dotenv import load_dotenv

load_dotenv()

NEWS_API_KEY = os.getenv("NEWS_API_KEY")
NEWS_API_URL = "https://newsapi.org/v2/everything"


def _parse_articles(articles: list) -> list[dict]:
    return [
        {
            "title": a["title"],
            "description": a.get("description", ""),
            "source": a["source"]["name"],
            "published_at": a["publishedAt"],
            "url": a["url"],
        }
        for a in articles
        if a.get("title") and "[Removed]" not in a.get("title", "")
    ]


def fetch_investor_news(investor_name: str, limit: int = 6) -> list[dict]:
    # 쿼리를 단계적으로 시도: 정확한 이름 → 이름만 (따옴표 없이)
    queries = [
        f'"{investor_name}"',
        investor_name,
    ]
    for q in queries:
        try:
            params = {
                "q": q,
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": limit,
                "apiKey": NEWS_API_KEY,
            }
            r = requests.get(NEWS_API_URL, params=params, timeout=10)
            r.raise_for_status()
            results = _parse_articles(r.json().get("articles", []))
            if results:
                return results
        except Exception:
            continue
    return []


def fetch_stock_news(ticker: str, limit: int = 5) -> list[dict]:
    try:
        params = {
            "q": ticker,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": limit,
            "apiKey": NEWS_API_KEY,
        }
        r = requests.get(NEWS_API_URL, params=params, timeout=10)
        r.raise_for_status()
        articles = r.json().get("articles", [])
        return [
            {
                "title": a["title"],
                "description": a.get("description", ""),
                "source": a["source"]["name"],
                "published_at": a["publishedAt"],
                "url": a["url"],
            }
            for a in articles
            if a.get("title") and "[Removed]" not in a.get("title", "")
        ]
    except Exception:
        return []

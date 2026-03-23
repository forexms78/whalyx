import os
import requests
from dotenv import load_dotenv

load_dotenv()

NEWS_API_KEY = os.getenv("NEWS_API_KEY")
NEWS_API_URL = "https://newsapi.org/v2/everything"

GEOPOLITICAL_KEYWORDS = [
    "war", "conflict", "sanctions", "military", "invasion",
    "전쟁", "분쟁", "제재", "군사", "침공", "지정학"
]


def collect_news(portfolio: list[str]) -> list[dict]:
    query = " OR ".join(GEOPOLITICAL_KEYWORDS[:5])
    params = {
        "q": query,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": 20,
        "apiKey": NEWS_API_KEY,
    }
    try:
        response = requests.get(NEWS_API_URL, params=params, timeout=10)
        response.raise_for_status()
        articles = response.json().get("articles", [])
        return [
            {
                "title": a["title"],
                "description": a.get("description", ""),
                "source": a["source"]["name"],
                "published_at": a["publishedAt"],
                "url": a["url"],
            }
            for a in articles
            if a.get("title") and a.get("description")
        ]
    except Exception as e:
        return [{"error": str(e), "title": "NewsAPI 오류", "description": "", "source": "", "published_at": "", "url": ""}]

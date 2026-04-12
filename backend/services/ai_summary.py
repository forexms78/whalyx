import json
import re
import time
from backend.utils.gemini import call_gemini

SYSTEM = """
당신은 월스트리트 투자 분석가입니다.
유명 투자자의 최신 동향과 보유 종목을 간결하고 날카롭게 분석합니다.
한국어로 응답하세요.
"""


def generate_investor_insight(investor_name: str, firm: str, recent_moves: str, news_titles: list[str]) -> str:
    news_text = "\n".join([f"- {t}" for t in news_titles[:5]])
    prompt = f"""
투자자: {investor_name} ({firm})
최근 포트폴리오 변화: {recent_moves}

최신 뉴스 헤드라인:
{news_text or "뉴스 없음"}

위 정보를 바탕으로 이 투자자의 현재 투자 전략과 주목할 포인트를 3~4문장으로 분석해주세요.
반드시 구체적이고 투자자에게 유용한 인사이트를 제공하세요.
"""
    try:
        return call_gemini(prompt, SYSTEM)
    except Exception:
        return f"{investor_name}의 최신 포트폴리오 동향을 분석 중입니다."


def generate_stock_insight(ticker: str, name: str, change_pct: float, news_titles: list[str]) -> str:
    news_text = "\n".join([f"- {t}" for t in news_titles[:4]])
    direction = "상승" if change_pct >= 0 else "하락"
    prompt = f"""
종목: {name} ({ticker})
최근 30일 수익률: {change_pct:+.1f}% ({direction})

최신 뉴스:
{news_text or "뉴스 없음"}

이 종목의 최근 동향과 유명 투자자들이 주목하는 이유를 2~3문장으로 설명해주세요.
"""
    try:
        return call_gemini(prompt, SYSTEM)
    except Exception:
        return f"{name} 종목 분석 중입니다."


_market_driver_cache: tuple[dict, float] | None = None
_MARKET_DRIVER_TTL = 1800  # 30분
_MARKET_DRIVER_DB_KEY = "market_driver"


def generate_market_drivers(headlines: list[dict]) -> dict:
    """오늘의 마켓 드라이버 3개 선정 — Gemini가 전체 헤드라인에서 시장 변동성 핵심 뉴스 추출"""
    global _market_driver_cache
    now = time.time()

    # 메모리 캐시
    if _market_driver_cache and now - _market_driver_cache[1] < _MARKET_DRIVER_TTL:
        return _market_driver_cache[0]

    # DB 캐시 (서버 재시작 후에도 유지)
    try:
        from backend.services.db_cache import db_get, db_set
        cached = db_get(_MARKET_DRIVER_DB_KEY, ttl=_MARKET_DRIVER_TTL)
        if cached:
            _market_driver_cache = (cached, now)
            return cached
    except Exception:
        pass

    top = headlines[:20]
    headline_text = "\n".join(
        f"[{i}] {item['title']} ({item.get('source', '')})"
        for i, item in enumerate(top)
    )

    prompt = f"""다음은 오늘의 글로벌 뉴스 헤드라인입니다.

{headline_text}

투자자 관점에서 오늘 금융 시장(주식·채권·환율·코인·원자재)에 가장 큰 영향을 미치는 핵심 뉴스 3개를 골라 아래 JSON으로만 응답하세요. 코드블록 없이 순수 JSON만:
{{
  "drivers": [
    {{
      "idx": 0,
      "headline": "15자 이내 핵심 요약 (한국어)",
      "impact": "이 뉴스가 어떤 자산에 어떤 영향을 주는지 한 문장 (한국어)",
      "direction": "bullish|bearish|mixed"
    }}
  ]
}}
반드시 3개, 오늘 시장을 가장 크게 움직이는 순서로 나열하세요."""

    try:
        raw = call_gemini(prompt, SYSTEM)
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        parsed = json.loads(match.group() if match else raw)
        drivers = parsed.get("drivers", [])[:3]

        # 원본 헤드라인 URL·이미지 매핑
        for d in drivers:
            idx = d.get("idx", -1)
            if 0 <= idx < len(top):
                d["url"] = top[idx].get("url", "")
                d["source"] = top[idx].get("source", "")
                d["original_title"] = top[idx].get("title", "")
                d["image_url"] = top[idx].get("image_url", "")

        result = {"drivers": drivers, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        _market_driver_cache = (result, now)
        try:
            db_set(_MARKET_DRIVER_DB_KEY, result)
        except Exception:
            pass
        return result
    except Exception:
        return {"drivers": [], "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}


_news_ai_cache: tuple[dict, float] | None = None
_NEWS_AI_TTL = 1800  # 30분


def generate_news_analysis(news_by_category: dict[str, list[dict]]) -> dict:
    global _news_ai_cache
    now = time.time()
    if _news_ai_cache and now - _news_ai_cache[1] < _NEWS_AI_TTL:
        return _news_ai_cache[0]

    # 뉴스 목록 플래튼 + 인덱스 부여
    all_news: list[dict] = []
    for category, articles in news_by_category.items():
        for a in articles:
            all_news.append({**a, "category": category})

    # Gemini에 보낼 헤드라인 (최대 20개)
    top = all_news[:20]
    headlines = "\n".join(
        f"[{i}] ({item['category']}) {item['title']}"
        for i, item in enumerate(top)
    )

    prompt = f"""다음은 글로벌 금융 시장 최신 뉴스입니다.

{headlines}

아래 JSON 형식으로만 응답하세요. 코드블록 없이 순수 JSON만:
{{
  "sentiment": "Bullish|Neutral|Bearish",
  "sentiment_score": 0~100,
  "summary": "3~4문장 한국어 종합 분석",
  "themes": [
    {{"title": "핵심 테마 제목", "detail": "한국어 설명 1~2문장", "assets": ["주식","채권"]}}
  ],
  "articles": [
    {{"idx": 0, "sentiment": "positive|negative|neutral", "summary": "한국어 20자 이내 요약"}}
  ]
}}
themes는 3개, articles는 뉴스 전체 인덱스에 대해 작성하세요."""

    raw = call_gemini(prompt, SYSTEM)
    # JSON 추출 (마크다운 코드블록 방어)
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    parsed = json.loads(match.group() if match else raw)

    # articles 인덱스로 뉴스에 ai_summary 매핑
    ai_map = {a["idx"]: a for a in parsed.get("articles", [])}
    enriched = []
    for i, item in enumerate(top):
        ai_info = ai_map.get(i, {})
        enriched.append({
            "title": item["title"],
            "source": item.get("source", ""),
            "published_at": item.get("published_at", ""),
            "url": item.get("url", ""),
            "image_url": item.get("image_url", ""),
            "category": item["category"],
            "ai_summary": ai_info.get("summary", ""),
            "sentiment": ai_info.get("sentiment", "neutral"),
        })

    result = {
        "sentiment": parsed.get("sentiment", "Neutral"),
        "sentiment_score": parsed.get("sentiment_score", 50),
        "summary": parsed.get("summary", ""),
        "themes": parsed.get("themes", []),
        "news": enriched,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    _news_ai_cache = (result, now)
    return result

from backend.utils.gemini import call_gemini
import json


SYSTEM = """
당신은 지정학 이벤트 분류 전문가입니다.
뉴스 기사를 분석하여 이벤트 유형, 관련 국가, 영향 받는 산업 섹터를 분류합니다.
반드시 JSON 형식으로만 응답하세요.
"""


def classify_events(news_list: list[dict]) -> list[dict]:
    results = []
    for news in news_list[:10]:  # API 비용 절감을 위해 상위 10개만
        prompt = f"""
뉴스 제목: {news['title']}
뉴스 내용: {news['description']}

다음 JSON 형식으로 분류하세요:
{{
  "event_type": "전쟁|제재|분쟁|외교|기타",
  "countries": ["국가1", "국가2"],
  "affected_sectors": ["에너지|반도체|금융|방산|원자재|기타"],
  "severity": "높음|중간|낮음",
  "summary": "한 줄 요약"
}}
"""
        try:
            raw = call_gemini(prompt, SYSTEM)
            raw = raw.strip().removeprefix("```json").removesuffix("```").strip()
            classified = json.loads(raw)
            classified["original_title"] = news["title"]
            classified["published_at"] = news.get("published_at", "")
            results.append(classified)
        except Exception:
            results.append({
                "event_type": "기타",
                "countries": [],
                "affected_sectors": [],
                "severity": "낮음",
                "summary": news["title"],
                "original_title": news["title"],
                "published_at": news.get("published_at", ""),
            })
    return results

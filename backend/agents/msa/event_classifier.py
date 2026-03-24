from backend.utils.gemini import call_gemini
import json


SYSTEM = """
당신은 지정학 이벤트 분류 전문가입니다.
뉴스 기사 목록을 분석하여 각 기사의 이벤트 유형, 관련 국가, 영향 받는 산업 섹터를 분류합니다.
반드시 JSON 배열 형식으로만 응답하세요.
"""


def classify_events(news_list: list[dict]) -> list[dict]:
    target = news_list[:5]  # 상위 5개 배치 처리 (1회 호출)
    if not target:
        return []

    articles_text = "\n".join([
        f"{i+1}. 제목: {n['title']}\n   내용: {n.get('description', '')[:200]}"
        for i, n in enumerate(target)
    ])

    prompt = f"""
다음 {len(target)}개의 뉴스 기사를 분석하여 JSON 배열로 반환하세요.
각 항목은 아래 형식을 따르세요:

{articles_text}

응답 형식 (배열 순서는 기사 번호 순서와 동일):
[
  {{
    "event_type": "전쟁|제재|분쟁|외교|기타",
    "countries": ["국가1", "국가2"],
    "affected_sectors": ["에너지|반도체|금융|방산|원자재|기타"],
    "severity": "높음|중간|낮음",
    "summary": "한 줄 요약"
  }}
]
"""
    try:
        raw = call_gemini(prompt, SYSTEM)
        raw = raw.strip().removeprefix("```json").removesuffix("```").strip()
        classified_list = json.loads(raw)
        results = []
        for i, classified in enumerate(classified_list):
            classified["original_title"] = target[i]["title"]
            classified["published_at"] = target[i].get("published_at", "")
            results.append(classified)
        return results
    except Exception:
        return [
            {
                "event_type": "기타",
                "countries": [],
                "affected_sectors": [],
                "severity": "낮음",
                "summary": n["title"],
                "original_title": n["title"],
                "published_at": n.get("published_at", ""),
            }
            for n in target
        ]

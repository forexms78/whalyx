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

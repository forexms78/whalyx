"""
Supervisor 1 — 데이터 파이프라인
담당 MSA: NewsCollector, EventClassifier, SentimentAnalyzer, FinancialData
"""
from backend.graph.state import PortfolioState
from backend.agents.msa.news_collector import collect_news
from backend.agents.msa.event_classifier import classify_events
from backend.agents.msa.sentiment_analyzer import analyze_sentiment
from backend.agents.msa.financial_data import fetch_financial_data


def supervisor_1(state: PortfolioState) -> dict:
    portfolio = state["portfolio"]

    print("[Supervisor 1] 뉴스 수집 중...")
    raw_news = collect_news(portfolio)

    print("[Supervisor 1] 이벤트 분류 중...")
    classified_events = classify_events(raw_news)

    print("[Supervisor 1] 감정 분석 중...")
    sentiment_scores = analyze_sentiment(classified_events)

    print("[Supervisor 1] 금융 데이터 수집 중...")
    financial_data = fetch_financial_data(portfolio)

    print("[Supervisor 1] 데이터 파이프라인 완료")
    return {
        "raw_news": raw_news,
        "classified_events": classified_events,
        "sentiment_scores": sentiment_scores,
        "financial_data": financial_data,
    }

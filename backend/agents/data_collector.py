from backend.graph.state import PortfolioState
from backend.agents.msa.news_collector import collect_news
from backend.agents.msa.financial_data import fetch_financial_data


def data_collector(state: PortfolioState) -> dict:
    news = collect_news(state["portfolio"])
    financial = fetch_financial_data(state["portfolio"])
    return {"raw_news": news, "financial_data": financial}

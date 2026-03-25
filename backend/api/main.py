from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.services.investors import get_all_investors, get_investor, get_hot_tickers
from backend.services.news import fetch_investor_news, fetch_stock_news
from backend.services.financial import get_stock_data, get_multiple_stocks
from backend.services.ai_summary import generate_investor_insight, generate_stock_insight

app = FastAPI(title="Smart Money API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "Smart Money API"}


@app.get("/investors")
def list_investors():
    """전체 투자자 목록 + 각 투자자 상위 3개 종목 주가"""
    investors = get_all_investors()
    all_tickers = list({t for inv in investors for t in inv["top_holdings"]})
    prices = get_multiple_stocks(all_tickers)
    for inv in investors:
        inv["holdings_data"] = [
            {
                "ticker": t,
                "price": prices.get(t, {}).get("current_price"),
                "change_1d_pct": prices.get(t, {}).get("change_1d_pct"),
            }
            for t in inv["top_holdings"]
        ]
    return {"investors": investors}


@app.get("/investors/{investor_id}")
def get_investor_detail(investor_id: str):
    """투자자 상세: 포트폴리오 + 주가 + 뉴스 + AI 인사이트"""
    investor = get_investor(investor_id)
    if not investor:
        raise HTTPException(status_code=404, detail="투자자를 찾을 수 없습니다")

    tickers = [p["ticker"] for p in investor["portfolio"]]
    prices = get_multiple_stocks(tickers)
    news = fetch_investor_news(investor["name"])
    news_titles = [n["title"] for n in news if n.get("title")]

    insight = generate_investor_insight(
        investor["name"],
        investor["firm"],
        investor["recent_moves"],
        news_titles,
    )

    portfolio_with_prices = []
    for holding in investor["portfolio"]:
        stock = prices.get(holding["ticker"], {})
        portfolio_with_prices.append({
            **holding,
            "current_price": stock.get("current_price"),
            "change_30d_pct": stock.get("change_30d_pct"),
            "change_1d_pct": stock.get("change_1d_pct"),
            "sector": stock.get("sector", ""),
        })

    return {
        **investor,
        "portfolio": portfolio_with_prices,
        "news": news,
        "insight": insight,
    }


@app.get("/stocks/hot")
def hot_stocks():
    """유명 투자자들이 주목하는 핫 종목 TOP 10"""
    tickers = get_hot_tickers()
    stocks = get_multiple_stocks(tickers)
    result = []
    for ticker in tickers:
        data = stocks.get(ticker, {})
        if "error" not in data:
            result.append(data)
    return {"stocks": result}


@app.get("/stocks/{ticker}")
def stock_detail(ticker: str):
    """종목 상세: 주가 차트 + 뉴스 + AI 분석"""
    ticker = ticker.upper()
    data = get_stock_data(ticker)
    if "error" in data:
        raise HTTPException(status_code=404, detail="종목 데이터를 가져올 수 없습니다")

    news = fetch_stock_news(ticker)
    news_titles = [n["title"] for n in news if n.get("title")]
    insight = generate_stock_insight(
        ticker,
        data.get("name", ticker),
        data.get("change_30d_pct", 0),
        news_titles,
    )

    return {**data, "news": news, "insight": insight}

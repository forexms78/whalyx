import yfinance as yf
from datetime import datetime, timedelta


SECTOR_MAP = {
    "삼성전자": "반도체",
    "005930.KS": "반도체",
    "TSM": "반도체",
    "NVDA": "반도체",
    "AAPL": "기술",
    "MSFT": "기술",
    "XOM": "에너지",
    "CVX": "에너지",
    "BA": "방산",
    "LMT": "방산",
    "JPM": "금융",
    "GS": "금융",
}


def get_ticker_symbol(stock_name: str) -> str:
    name_map = {
        "삼성전자": "005930.KS",
        "삼성": "005930.KS",
        "TSMC": "TSM",
        "엔비디아": "NVDA",
        "애플": "AAPL",
        "마이크로소프트": "MSFT",
    }
    return name_map.get(stock_name, stock_name)


def fetch_financial_data(portfolio: list[str]) -> dict:
    result = {}
    end_date = datetime.today()
    start_date = end_date - timedelta(days=30)

    for stock in portfolio:
        ticker_symbol = get_ticker_symbol(stock)
        try:
            ticker = yf.Ticker(ticker_symbol)
            hist = ticker.history(start=start_date.strftime("%Y-%m-%d"), end=end_date.strftime("%Y-%m-%d"))

            if hist.empty:
                result[stock] = {"error": "데이터 없음", "ticker": ticker_symbol}
                continue

            current_price = float(hist["Close"].iloc[-1])
            prev_price = float(hist["Close"].iloc[0])
            change_pct = ((current_price - prev_price) / prev_price) * 100
            volatility = float(hist["Close"].pct_change().std() * 100)

            result[stock] = {
                "ticker": ticker_symbol,
                "current_price": round(current_price, 2),
                "change_30d_pct": round(change_pct, 2),
                "volatility": round(volatility, 2),
                "sector": SECTOR_MAP.get(ticker_symbol, SECTOR_MAP.get(stock, "기타")),
            }
        except Exception as e:
            result[stock] = {"error": str(e), "ticker": ticker_symbol}

    return result

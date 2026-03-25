export interface HoldingData {
  ticker: string;
  price?: number | null;
  change_1d_pct?: number | null;
}

export interface InvestorSummary {
  id: string;
  name: string;
  title: string;
  firm: string;
  avatar_initial: string;
  color: string;
  description: string;
  top_holdings: string[];
  recent_moves: string;
  holdings_data: HoldingData[];
}

export interface PortfolioHolding {
  ticker: string;
  name: string;
  weight: number;
  shares: number;
  action: "buy" | "sell" | "hold";
  current_price?: number | null;
  change_30d_pct?: number | null;
  change_1d_pct?: number | null;
  sector?: string;
}

export interface NewsItem {
  title: string;
  description: string;
  source: string;
  published_at: string;
  url: string;
}

export interface InvestorDetail {
  id: string;
  name: string;
  title: string;
  firm: string;
  avatar_initial: string;
  color: string;
  description: string;
  known_for: string;
  recent_moves: string;
  portfolio: PortfolioHolding[];
  news: NewsItem[];
  insight: string;
}

export interface ChartPoint {
  date: string;
  price: number;
}

export interface StockDetail {
  ticker: string;
  name: string;
  sector?: string;
  industry?: string;
  market_cap?: number | null;
  current_price?: number;
  change_30d_pct?: number;
  change_1d_pct?: number;
  volatility?: number;
  chart: ChartPoint[];
  news: NewsItem[];
  insight: string;
}

export interface HotStock {
  ticker: string;
  name: string;
  current_price?: number;
  change_30d_pct?: number;
  change_1d_pct?: number;
  sector?: string;
}

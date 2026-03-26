export interface HoldingData {
  ticker: string;
  price?: number | null;
  change_1d_pct?: number | null;
  change_30d_pct?: number | null;
}

export interface InvestorSummary {
  id: string;
  name: string;
  title: string;
  firm: string;
  style: string;
  avatar_initial: string;
  color: string;
  description: string;
  known_for: string;
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
  image_url?: string;
}

export interface InvestorDetail {
  id: string;
  name: string;
  title: string;
  firm: string;
  style: string;
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

export interface RecommendedStock {
  ticker: string;
  name: string;
  buyers?: string[];
  sellers?: string[];
  count: number;
  current_price?: number | null;
  change_30d_pct?: number | null;
}

export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  price_change_24h: number;
  price_change_7d: number;
  price_change_30d: number;
  sparkline: number[];
  image: string;
}

export interface RealEstateIndicator {
  label: string;
  value: string;
  change: string;
  unit: string;
  trend: "up" | "down" | "flat";
}

export interface CommodityData {
  ticker: string;
  name: string;
  category: string;
  current_price: number;
  change_30d_pct: number;
  change_1d_pct: number;
  chart: ChartPoint[];
  description: string;
}

export interface MoneyFlowAsset {
  category: string;
  name: string;
  value: string;
  change_30d: number | null;
  description: string;
  color: string;
  icon: string;
}

export interface AssetSignal {
  asset: string;
  label: "Strong Buy" | "Buy" | "Neutral" | "Avoid";
  score: number;
  color: string;
  picks: string[];
}

export interface WhaleSignal {
  headline: string;
  signals: AssetSignal[];
  ai_insight: string;
  fed_rate: number;
  updated_at: string;
}

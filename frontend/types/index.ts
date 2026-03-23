export interface StockRisk {
  sector: string;
  risk_score: number;
  risk_level: string;
  sector_reason: string;
  current_price: number | null;
  change_30d_pct: number | null;
  volatility: number | null;
}

export interface SectorRiskItem {
  score: number;
  reason: string;
}

export interface VisualizationData {
  portfolio_risk_chart: { stock: string; risk_score: number; risk_level: string; sector: string; change_30d: number }[];
  sector_risk_chart: { sector: string; score: number }[];
  event_timeline: { date: string; type: string; severity: string; summary: string }[];
  fear_index: number;
  overall_sentiment: string;
  overall_risk_level: string;
}

export interface AnalysisResult {
  final_report: string | null;
  pm_approved: boolean | null;
  pm_feedback: string | null;
  alerts: string[] | null;
  visualization_data: VisualizationData | null;
  portfolio_risk_mapping: Record<string, StockRisk> | null;
  overall_risk_level: string | null;
}

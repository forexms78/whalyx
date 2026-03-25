"use client";

import { AnalysisResult } from "@/types";
import RiskChart from "./RiskChart";
import AlertBanner from "./AlertBanner";
import ReportSection from "./ReportSection";
import StockRiskTable from "./StockRiskTable";

interface Props {
  result: AnalysisResult;
  onReset: () => void;
}

const RISK_COLORS: Record<string, string> = {
  매우높음: "#B71C1C",
  높음: "#E65100",
  중간: "#F57F17",
  낮음: "#1B5E20",
};

export default function Dashboard({ result, onReset }: Props) {
  const viz = result.visualization_data;
  const fearIndex = viz?.fear_index ?? 50;
  const overallRisk = result.overall_risk_level ?? "중간";

  return (
    <div className="space-y-4">
      {/* 상단 요약 카드 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          {[
            {
              label: "전체 리스크",
              value: overallRisk,
              color: RISK_COLORS[overallRisk] ?? "#1C1E21",
            },
            {
              label: "공포 지수",
              value: `${fearIndex} / 100`,
              color: "#E65100",
            },
            {
              label: "시장 감정",
              value: viz?.overall_sentiment ?? "-",
              color: "#1877F2",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl px-5 py-3"
              style={{
                background: "#fff",
                border: "1px solid #E4E6EB",
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              }}
            >
              <p className="text-xs mb-1" style={{ color: "#65676B" }}>
                {item.label}
              </p>
              <p className="text-base font-bold" style={{ color: item.color }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
        <button
          onClick={onReset}
          className="text-sm px-4 py-2 rounded-lg transition-colors"
          style={{
            color: "#1877F2",
            border: "1px solid #1877F2",
            background: "#fff",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#E7F3FF";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#fff";
          }}
        >
          새 분석
        </button>
      </div>

      {/* 알림 */}
      {result.alerts && result.alerts.length > 0 && (
        <AlertBanner alerts={result.alerts} />
      )}

      {/* 차트 */}
      <div className="grid grid-cols-2 gap-4">
        {viz?.portfolio_risk_chart && (
          <RiskChart data={viz.portfolio_risk_chart} title="종목별 리스크 점수" />
        )}
        {viz?.sector_risk_chart && (
          <RiskChart
            data={viz.sector_risk_chart.map((d) => ({
              stock: d.sector,
              risk_score: d.score,
              risk_level: "",
              sector: d.sector,
              change_30d: 0,
            }))}
            title="섹터별 리스크 점수"
          />
        )}
      </div>

      {/* 종목 테이블 */}
      {result.portfolio_risk_mapping && (
        <StockRiskTable mapping={result.portfolio_risk_mapping} />
      )}

      {/* AI 리포트 */}
      {result.final_report && (
        <ReportSection report={result.final_report} />
      )}
    </div>
  );
}

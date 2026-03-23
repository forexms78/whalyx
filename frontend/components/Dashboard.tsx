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
  매우높음: "text-red-400",
  높음: "text-orange-400",
  중간: "text-yellow-400",
  낮음: "text-green-400",
};

export default function Dashboard({ result, onReset }: Props) {
  const viz = result.visualization_data;
  const fearIndex = viz?.fear_index ?? 50;
  const overallRisk = result.overall_risk_level ?? "중간";

  return (
    <div className="space-y-6">
      {/* 상단 요약 바 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3">
            <p className="text-xs text-gray-500 mb-1">전체 리스크</p>
            <p className={`text-lg font-bold ${RISK_COLORS[overallRisk] ?? "text-white"}`}>{overallRisk}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3">
            <p className="text-xs text-gray-500 mb-1">공포 지수</p>
            <p className="text-lg font-bold text-orange-400">{fearIndex} / 100</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3">
            <p className="text-xs text-gray-500 mb-1">시장 감정</p>
            <p className="text-lg font-bold text-blue-400">{viz?.overall_sentiment ?? "-"}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3">
            <p className="text-xs text-gray-500 mb-1">PM 승인</p>
            <p className={`text-lg font-bold ${result.pm_approved ? "text-green-400" : "text-red-400"}`}>
              {result.pm_approved ? "APPROVED" : "REVISION"}
            </p>
          </div>
        </div>
        <button
          onClick={onReset}
          className="text-sm text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-xl transition-colors"
        >
          새 분석
        </button>
      </div>

      {/* 알림 */}
      {result.alerts && result.alerts.length > 0 && (
        <AlertBanner alerts={result.alerts} />
      )}

      {/* 차트 + 테이블 */}
      <div className="grid grid-cols-2 gap-6">
        {viz?.portfolio_risk_chart && (
          <RiskChart data={viz.portfolio_risk_chart} title="종목별 리스크 점수" />
        )}
        {viz?.sector_risk_chart && (
          <RiskChart data={viz.sector_risk_chart.map(d => ({ stock: d.sector, risk_score: d.score, risk_level: "", sector: d.sector, change_30d: 0 }))} title="섹터별 리스크 점수" />
        )}
      </div>

      {result.portfolio_risk_mapping && (
        <StockRiskTable mapping={result.portfolio_risk_mapping} />
      )}

      {/* AI 리포트 */}
      {result.final_report && (
        <ReportSection report={result.final_report} feedback={result.pm_feedback} />
      )}
    </div>
  );
}

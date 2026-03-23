"use client";

import { StockRisk } from "@/types";

interface Props {
  mapping: Record<string, StockRisk>;
}

const LEVEL_BADGE: Record<string, string> = {
  매우높음: "bg-red-900/50 text-red-400 border-red-800",
  높음: "bg-orange-900/50 text-orange-400 border-orange-800",
  중간: "bg-yellow-900/50 text-yellow-400 border-yellow-800",
  낮음: "bg-green-900/50 text-green-400 border-green-800",
};

export default function StockRiskTable({ mapping }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300">종목별 상세 리스크</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500 text-xs">
            <th className="text-left px-5 py-3">종목</th>
            <th className="text-left px-5 py-3">섹터</th>
            <th className="text-center px-5 py-3">리스크 점수</th>
            <th className="text-center px-5 py-3">수준</th>
            <th className="text-right px-5 py-3">30일 변동</th>
            <th className="text-right px-5 py-3">변동성</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(mapping).map(([stock, data]) => (
            <tr key={stock} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
              <td className="px-5 py-3 font-medium">{stock}</td>
              <td className="px-5 py-3 text-gray-400">{data.sector}</td>
              <td className="px-5 py-3 text-center">
                <span className="font-bold text-white">{data.risk_score}</span>
                <span className="text-gray-500 text-xs"> / 10</span>
              </td>
              <td className="px-5 py-3 text-center">
                <span className={`text-xs border px-2 py-0.5 rounded-full ${LEVEL_BADGE[data.risk_level] ?? ""}`}>
                  {data.risk_level}
                </span>
              </td>
              <td className={`px-5 py-3 text-right ${(data.change_30d_pct ?? 0) < 0 ? "text-red-400" : "text-green-400"}`}>
                {data.change_30d_pct != null ? `${data.change_30d_pct > 0 ? "+" : ""}${data.change_30d_pct.toFixed(1)}%` : "-"}
              </td>
              <td className="px-5 py-3 text-right text-gray-400">
                {data.volatility != null ? `${data.volatility.toFixed(1)}%` : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

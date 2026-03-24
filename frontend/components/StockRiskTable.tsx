"use client";

import { StockRisk } from "@/types";

interface Props {
  mapping: Record<string, StockRisk>;
}

const LEVEL_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  매우높음: { bg: "#FFF0F0", color: "#B71C1C", border: "#FFCDD2" },
  높음: { bg: "#FFF8E1", color: "#E65100", border: "#FFE082" },
  중간: { bg: "#FFFDE7", color: "#F57F17", border: "#FFF176" },
  낮음: { bg: "#F0FFF4", color: "#1B5E20", border: "#A5D6A7" },
};

export default function StockRiskTable({ mapping }: Props) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#fff",
        border: "1px solid #E4E6EB",
        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
      }}
    >
      <div
        className="px-5 py-4"
        style={{ borderBottom: "1px solid #E4E6EB" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "#1C1E21" }}>
          종목별 상세 리스크
        </h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid #E4E6EB", background: "#F0F2F5" }}>
            <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#65676B" }}>종목</th>
            <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#65676B" }}>섹터</th>
            <th className="text-center px-5 py-3 text-xs font-semibold" style={{ color: "#65676B" }}>리스크 점수</th>
            <th className="text-center px-5 py-3 text-xs font-semibold" style={{ color: "#65676B" }}>수준</th>
            <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#65676B" }}>30일 변동</th>
            <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#65676B" }}>변동성</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(mapping).map(([stock, data], idx) => (
            <tr
              key={stock}
              style={{
                borderBottom: "1px solid #F0F2F5",
                background: idx % 2 === 0 ? "#fff" : "#FAFAFA",
              }}
            >
              <td className="px-5 py-3 font-semibold" style={{ color: "#1C1E21" }}>
                {stock}
              </td>
              <td className="px-5 py-3" style={{ color: "#65676B" }}>
                {data.sector}
              </td>
              <td className="px-5 py-3 text-center">
                <span className="font-bold" style={{ color: "#1877F2" }}>
                  {data.risk_score}
                </span>
                <span className="text-xs" style={{ color: "#65676B" }}> / 10</span>
              </td>
              <td className="px-5 py-3 text-center">
                {(() => {
                  const badge = LEVEL_BADGE[data.risk_level] ?? {
                    bg: "#F0F2F5",
                    color: "#65676B",
                    border: "#CED0D4",
                  };
                  return (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {data.risk_level}
                    </span>
                  );
                })()}
              </td>
              <td
                className="px-5 py-3 text-right font-medium"
                style={{
                  color: (data.change_30d_pct ?? 0) < 0 ? "#B71C1C" : "#1B5E20",
                }}
              >
                {data.change_30d_pct != null
                  ? `${data.change_30d_pct > 0 ? "+" : ""}${data.change_30d_pct.toFixed(1)}%`
                  : "-"}
              </td>
              <td className="px-5 py-3 text-right" style={{ color: "#65676B" }}>
                {data.volatility != null ? `${data.volatility.toFixed(1)}%` : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

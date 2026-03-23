"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface ChartItem {
  stock: string;
  risk_score: number;
  risk_level: string;
  sector: string;
  change_30d: number;
}

interface Props {
  data: ChartItem[];
  title: string;
}

const getBarColor = (score: number) => {
  if (score >= 8) return "#f87171";
  if (score >= 6) return "#fb923c";
  if (score >= 4) return "#facc15";
  return "#4ade80";
};

export default function RiskChart({ data, title }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="stock" tick={{ fontSize: 11, fill: "#9ca3af" }} />
          <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#9ca3af" }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px" }}
            labelStyle={{ color: "#f3f4f6" }}
            formatter={(value: number) => [`${value} / 10`, "리스크 점수"]}
          />
          <Bar dataKey="risk_score" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={getBarColor(entry.risk_score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

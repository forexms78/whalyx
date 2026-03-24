"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

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
  if (score >= 8) return "#E53935";
  if (score >= 6) return "#FB8C00";
  if (score >= 4) return "#FDD835";
  return "#43A047";
};

export default function RiskChart({ data, title }: Props) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "#fff",
        border: "1px solid #E4E6EB",
        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
      }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: "#1C1E21" }}>
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E4E6EB" />
          <XAxis
            dataKey="stock"
            tick={{ fontSize: 11, fill: "#65676B" }}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fontSize: 11, fill: "#65676B" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #E4E6EB",
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}
            labelStyle={{ color: "#1C1E21", fontWeight: 600 }}
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

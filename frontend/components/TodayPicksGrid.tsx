"use client";

import StockPickCard, { StockPickCardProps } from "./StockPickCard";

interface TodayPicksGridProps {
  items: Omit<StockPickCardProps, "type">[];
  type: "buy" | "sell" | "watch";
}

const SECTION_LABELS = {
  buy:   { text: "▲ 매수 추천",         color: "#22c55e" },
  sell:  { text: "▼ 매도 추천",         color: "#ef4444" },
  watch: { text: "◎ 고거래량 관심 종목", color: "#f59e0b" },
};

export default function TodayPicksGrid({ items, type }: TodayPicksGridProps) {
  const label = SECTION_LABELS[type];

  return (
    <div style={{ marginBottom: 28 }}>
      {/* 섹션 레이블 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "1.5px",
          textTransform: "uppercase", color: label.color,
        }}>
          {label.text}
        </span>
        <div style={{ flex: 1, height: 1, background: label.color, opacity: 0.2 }} />
      </div>

      {/* 3열 그리드 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
      }}>
        {items.map(item => (
          <StockPickCard key={item.ticker} {...item} type={type} />
        ))}
      </div>
    </div>
  );
}

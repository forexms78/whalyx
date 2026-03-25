"use client";

import { useState } from "react";
import { HotStock } from "@/types";
import StockModal from "./StockModal";

interface Props {
  stocks: HotStock[];
}

export default function HotStocks({ stocks }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  if (!stocks.length) return null;

  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>핫 종목</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "2px 10px" }}>
          유명 투자자들이 주목하는 TOP 10
        </span>
      </div>

      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
        {stocks.map(s => {
          const isUp = (s.change_30d_pct ?? 0) >= 0;
          return (
            <div
              key={s.ticker}
              onClick={() => setSelected(s.ticker)}
              style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "12px 16px", cursor: "pointer",
                flexShrink: 0, minWidth: 110, transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)";
                (e.currentTarget as HTMLDivElement).style.background = "var(--card-hover)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLDivElement).style.background = "var(--card)";
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)", marginBottom: 4 }}>{s.ticker}</div>
              {s.current_price && (
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>${s.current_price.toLocaleString()}</div>
              )}
              {s.change_30d_pct !== undefined && (
                <div style={{ fontSize: 12, color: isUp ? "var(--green)" : "var(--red)" }}>
                  {isUp ? "▲" : "▼"} {Math.abs(s.change_30d_pct).toFixed(1)}%
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected && <StockModal ticker={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

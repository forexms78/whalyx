"use client";

import { HotStock } from "@/types";

interface Props {
  stocks: HotStock[];
  onSelect: (ticker: string) => void;
}

export default function TopPerformersSection({ stocks, onSelect }: Props) {
  const sorted = [...stocks]
    .filter((s) => s.change_30d_pct != null)
    .sort((a, b) => (b.change_30d_pct ?? 0) - (a.change_30d_pct ?? 0))
    .slice(0, 6);

  if (sorted.length === 0) return null;

  return (
    <section style={{ marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 14,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Top Performers
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            13F 보유 종목 중 최근 30일 수익률 상위
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {sorted.map((s) => {
          const chg = s.change_30d_pct ?? 0;
          const isUp = chg >= 0;
          const color = isUp ? "var(--green)" : "var(--red)";
          return (
            <button
              key={s.ticker}
              onClick={() => onSelect(s.ticker)}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "14px 16px",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 12,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.borderColor = "var(--accent-glow)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "var(--text-secondary)",
                  flexShrink: 0,
                  letterSpacing: "-0.02em",
                }}
              >
                {s.ticker.slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {s.ticker}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.name}
                </div>
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color,
                  letterSpacing: "-0.01em",
                  flexShrink: 0,
                }}
              >
                {isUp ? "+" : ""}
                {chg.toFixed(1)}%
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

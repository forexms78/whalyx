"use client";

import { InvestorSummary } from "@/types";

interface Props {
  investor: InvestorSummary;
  onClick: () => void;
}

const ACTION_COLOR: Record<string, string> = {
  buy: "#10b981",
  sell: "#ef4444",
  hold: "#8892a4",
};

export default function InvestorCard({ investor, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--card-hover)";
        (e.currentTarget as HTMLDivElement).style.borderColor = investor.color;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--card)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {/* 상단: 아바타 + 이름 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: investor.color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0,
        }}>
          {investor.avatar_initial}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{investor.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{investor.title}</div>
        </div>
      </div>

      {/* 설명 */}
      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 14 }}>
        {investor.description}
      </p>

      {/* 주요 보유 종목 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          주요 보유 종목
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {investor.holdings_data.map(h => (
            <div key={h.ticker} style={{
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.2)",
              borderRadius: 6, padding: "3px 8px",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{h.ticker}</span>
              {h.change_1d_pct !== null && h.change_1d_pct !== undefined && (
                <span style={{
                  fontSize: 11,
                  color: h.change_1d_pct >= 0 ? "var(--green)" : "var(--red)",
                }}>
                  {h.change_1d_pct >= 0 ? "+" : ""}{h.change_1d_pct.toFixed(1)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 최근 동향 */}
      <div style={{
        fontSize: 12, color: "var(--text-secondary)",
        borderTop: "1px solid var(--border)", paddingTop: 12,
        lineHeight: 1.5,
      }}>
        <span style={{ color: "var(--gold)", fontWeight: 600 }}>최근 ›</span> {investor.recent_moves}
      </div>
    </div>
  );
}

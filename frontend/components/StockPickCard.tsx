"use client";

export interface StockPickCardProps {
  ticker: string;
  name: string;
  price: number;
  change_pct: number;
  reason: string;
  type: "buy" | "sell" | "watch";
}

const TYPE_COLORS = {
  buy:   { border: "#22c55e", glow: "rgba(34,197,94,0.08)",  text: "#22c55e", changeBg: "rgba(34,197,94,0.12)"  },
  sell:  { border: "#ef4444", glow: "rgba(239,68,68,0.08)",  text: "#ef4444", changeBg: "rgba(239,68,68,0.12)"  },
  watch: { border: "#f59e0b", glow: "rgba(245,158,11,0.08)", text: "#f59e0b", changeBg: "rgba(245,158,11,0.12)" },
};

export default function StockPickCard({ ticker, name, price, change_pct, reason, type }: StockPickCardProps) {
  const c = TYPE_COLORS[type];
  const isUp = change_pct >= 0;

  return (
    <div style={{
      background: "var(--card)",
      border: `1px solid var(--border)`,
      borderTop: `2px solid ${c.border}`,
      borderRadius: 14,
      padding: 16,
      position: "relative",
      overflow: "hidden",
      cursor: "default",
      transition: "transform 0.15s, box-shadow 0.15s",
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 20px ${c.glow}`; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
    >
      {/* 상단 글로우 */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 60,
        background: c.border, opacity: 0.04, borderRadius: "14px 14px 0 0",
        pointerEvents: "none",
      }} />

      <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
        {ticker}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, marginBottom: 10 }}>
        {name}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
          ${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 700,
          padding: "2px 7px", borderRadius: 6,
          color: type === "watch" ? c.text : isUp ? "#22c55e" : "#ef4444",
          background: type === "watch" ? c.changeBg : isUp ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        }}>
          {change_pct >= 0 ? "+" : ""}{change_pct.toFixed(2)}%
        </span>
      </div>

      <div style={{
        fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55,
        borderTop: "1px solid var(--border)", paddingTop: 10,
      }}>
        {reason}
      </div>
    </div>
  );
}

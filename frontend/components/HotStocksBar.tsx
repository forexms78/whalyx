"use client";
import { HotStock } from "@/types";

interface Props {
  stocks: HotStock[];
  onSelect: (ticker: string) => void;
  usd_krw?: number | null;
}

export default function HotStocksBar({ stocks, onSelect, usd_krw }: Props) {
  const toKrw = (usd: number) => {
    const v = usd * (usd_krw ?? 0);
    if (v >= 1e6) return `₩${(v / 1e4).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}만`;
    return `₩${Math.round(v).toLocaleString("ko-KR")}`;
  };
  if (!stocks.length) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>고래들이 주목하는 종목</span>
        <span style={{
          fontSize: 11, color: "var(--accent)", background: "var(--accent-dim)",
          border: "1px solid var(--accent-glow)", borderRadius: 20, padding: "2px 10px",
          fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
        }}>TOP {stocks.length}</span>
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {stocks.map(s => {
          const isUp = (s.change_30d_pct ?? 0) >= 0;
          return (
            <button
              key={s.ticker}
              onClick={() => onSelect(s.ticker)}
              style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "10px 14px", cursor: "pointer",
                flexShrink: 0, minWidth: 100, transition: "all 0.15s",
                textAlign: "left",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "var(--accent-glow)";
                el.style.background = "var(--card-hover)";
                el.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "var(--border)";
                el.style.background = "var(--card)";
                el.style.transform = "translateY(0)";
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--accent)", marginBottom: 3 }}>{s.ticker}</div>
              {s.current_price && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>${s.current_price.toLocaleString()}</div>
                  {usd_krw && <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>{toKrw(s.current_price)}</div>}
                </>
              )}
              {s.change_30d_pct !== undefined && (
                <div style={{ fontSize: 11, color: isUp ? "var(--green)" : "var(--red)", fontWeight: 500 }}>
                  {isUp ? "▲" : "▼"} {Math.abs(s.change_30d_pct).toFixed(1)}%
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

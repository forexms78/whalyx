"use client";
import { RecommendedStock } from "@/types";

interface Props {
  recommendations: { buy: RecommendedStock[]; sell: RecommendedStock[] };
  onSelect: (ticker: string) => void;
  usd_krw?: number | null;
}

export default function RecommendSection({ recommendations, onSelect, usd_krw }: Props) {
  const { buy, sell } = recommendations;
  const toKrw = (usd: number) => {
    const v = usd * (usd_krw ?? 0);
    if (v >= 1e6) return `₩${(v / 1e4).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}만`;
    return `₩${Math.round(v).toLocaleString("ko-KR")}`;
  };
  if (!buy.length && !sell.length) return null;

  const Card = ({ item, type }: { item: RecommendedStock; type: "buy" | "sell" }) => {
    const isUp = (item.change_30d_pct ?? 0) >= 0;
    const color = type === "buy" ? "var(--green)" : "var(--red)";
    const bg = type === "buy" ? "var(--green-dim)" : "var(--red-dim)";
    const names = type === "buy" ? item.buyers : item.sellers;

    return (
      <button
        onClick={() => onSelect(item.ticker)}
        style={{
          background: "var(--card)", border: `1px solid var(--border)`,
          borderRadius: 12, padding: "14px 16px", cursor: "pointer",
          textAlign: "left", transition: "all 0.15s", width: "100%",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = color;
          (e.currentTarget as HTMLButtonElement).style.background = "var(--card-hover)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLButtonElement).style.background = "var(--card)";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 16, color: "var(--accent)" }}>{item.ticker}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
              background: bg, color, letterSpacing: "0.04em",
            }}>
              {type === "buy" ? "▲ 매수 추천" : "▼ 매도 주의"}
            </span>
          </div>
          {item.current_price && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>${item.current_price.toLocaleString()}</div>
              {usd_krw && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{toKrw(item.current_price)}</div>}
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
          {names?.join(" · ")}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {Array.from({ length: item.count }).map((_, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
            ))}
          </div>
          {item.change_30d_pct !== undefined && item.change_30d_pct !== null && (
            <span style={{ fontSize: 12, color: isUp ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
              {isUp ? "+" : ""}{item.change_30d_pct.toFixed(1)}% (30일)
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
        투자 추천 신호
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400, marginLeft: 8 }}>
          복수의 전문 투자자가 동시 매수/매도 중인 종목
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* 매수 추천 */}
        <div>
          <div style={{
            fontSize: 12, fontWeight: 600, color: "var(--green)",
            marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
            매수 추천 ({buy.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {buy.slice(0, 4).map(item => <Card key={item.ticker} item={item} type="buy" />)}
          </div>
        </div>
        {/* 매도 주의 */}
        <div>
          <div style={{
            fontSize: 12, fontWeight: 600, color: "var(--red)",
            marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--red)", display: "inline-block" }} />
            매도 주의 ({sell.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sell.slice(0, 4).map(item => <Card key={item.ticker} item={item} type="sell" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

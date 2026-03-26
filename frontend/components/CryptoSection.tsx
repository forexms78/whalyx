"use client";
import { CoinData, NewsItem } from "@/types";
import NewsCard from "@/components/NewsCard";

interface Props {
  coins: CoinData[];
  news: NewsItem[];
  usd_krw?: number | null;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80, h = 32;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

export default function CryptoSection({ coins, news, usd_krw }: Props) {
  const formatPrice = (p: number) => {
    if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (p >= 1) return `$${p.toFixed(2)}`;
    return `$${p.toFixed(4)}`;
  };
  const formatKrw = (p: number) => {
    const krw = p * (usd_krw ?? 0);
    if (krw >= 1e8) return `₩${(krw / 1e8).toFixed(2)}억`;
    return `₩${Math.round(krw).toLocaleString("ko-KR")}`;
  };
  const formatMCap = (mc: number) => {
    if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
    if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
    return `$${(mc / 1e6).toFixed(0)}M`;
  };

  return (
    <div>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>코인 시장</span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>CoinGecko 실시간</span>
      </div>

      {/* 코인 그리드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 32 }}>
        {coins.map(coin => {
          const isUp24 = coin.price_change_24h >= 0;
          const isUp30 = coin.price_change_30d >= 0;
          return (
            <div key={coin.id} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 14, padding: "16px 18px",
              transition: "all 0.15s",
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-light)";
                (e.currentTarget as HTMLDivElement).style.background = "var(--card-hover)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLDivElement).style.background = "var(--card)";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {coin.image && (
                    <img src={coin.image} alt={coin.symbol} width={32} height={32} style={{ borderRadius: "50%" }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{coin.symbol}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{coin.name}</div>
                  </div>
                </div>
                <Sparkline data={coin.sparkline} color={isUp30 ? "#10b981" : "#ef4444"} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{formatPrice(coin.current_price)}</div>
                  {usd_krw && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>{formatKrw(coin.current_price)}</div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>시총 {formatMCap(coin.market_cap)}</div>
                </div>
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 12, color: isUp24 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                    24h {isUp24 ? "+" : ""}{coin.price_change_24h.toFixed(2)}%
                  </span>
                  <span style={{ fontSize: 11, color: isUp30 ? "var(--green)" : "var(--red)" }}>
                    30d {isUp30 ? "+" : ""}{coin.price_change_30d.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 코인 뉴스 */}
      {news.length > 0 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>코인 최신 뉴스</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {news.map((n, i) => (
              <NewsCard key={i} news={n} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

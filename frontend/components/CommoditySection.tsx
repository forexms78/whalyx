"use client";
import { CommodityData, NewsItem } from "@/types";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface Props {
  commodities: CommodityData[];
  news: NewsItem[];
  usd_krw?: number | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  "귀금속": "#E8A855",
  "산업금속": "#8B9DC3",
  "에너지": "#10b981",
  "배터리": "#8B5CF6",
};

export default function CommoditySection({ commodities, news, usd_krw }: Props) {
  const formatPrice = (p: number) => {
    if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (p >= 1) return `$${p.toFixed(2)}`;
    return `$${p.toFixed(4)}`;
  };
  const formatKrw = (p: number) => {
    const krw = p * (usd_krw ?? 0);
    if (krw >= 1e8) return `₩${(krw / 1e8).toFixed(1)}억`;
    return `₩${Math.round(krw).toLocaleString("ko-KR")}`;
  };

  return (
    <div>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>광물 시장</span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>주요 원자재 실시간</span>
      </div>

      {/* 광물 카드 그리드 */}
      <div className="grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 32 }}>
        {commodities.map(item => {
          const catColor = CATEGORY_COLORS[item.category] || "var(--accent)";
          const isUp30 = item.change_30d_pct >= 0;
          const isUp1d = item.change_1d_pct >= 0;
          const noPrice = !item.current_price;
          return (
            <div key={item.ticker} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 14, padding: "16px 18px",
              transition: "all 0.15s",
              opacity: noPrice ? 0.5 : 1,
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
              {/* 상단: 이름 + 카테고리 뱃지 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{item.name}</div>
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    color: catColor,
                    background: `${catColor}1a`,
                    border: `1px solid ${catColor}33`,
                    borderRadius: 6, padding: "2px 8px",
                    display: "inline-block", marginTop: 4,
                  }}>
                    {item.category}
                  </span>
                </div>
                {/* 미니 차트 */}
                {item.chart && item.chart.length > 0 && (
                  <div style={{ width: 80, height: 36 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={item.chart}>
                        <defs>
                          <linearGradient id={`grad-${item.ticker}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isUp30 ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={isUp30 ? "#10b981" : "#ef4444"} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone" dataKey="price"
                          stroke={isUp30 ? "#10b981" : "#ef4444"} strokeWidth={1.5}
                          fill={`url(#grad-${item.ticker})`}
                          dot={false} isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* 가격 + 변동률 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>
                    {noPrice ? <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>데이터 로딩 중...</span> : formatPrice(item.current_price)}
                  </div>
                  {!noPrice && usd_krw && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>{formatKrw(item.current_price)}</div>
                  )}
                  <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.4, maxWidth: 160 }}>{item.description}</div>
                </div>
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 12, color: isUp1d ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                    1d {isUp1d ? "+" : ""}{item.change_1d_pct.toFixed(2)}%
                  </span>
                  <span style={{ fontSize: 11, color: isUp30 ? "var(--green)" : "var(--red)" }}>
                    30d {isUp30 ? "+" : ""}{item.change_30d_pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 광물 뉴스는 AI 뉴스 탭에서 확인하세요 */}
    </div>
  );
}

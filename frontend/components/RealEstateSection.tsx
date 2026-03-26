"use client";
import { RealEstateIndicator, NewsItem } from "@/types";
import NewsCard from "@/components/NewsCard";

interface Props {
  indicators: RealEstateIndicator[];
  news: NewsItem[];
}

export default function RealEstateSection({ indicators, news }: Props) {
  return (
    <div>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>한국 부동산</span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>주요 지표 · 최신 뉴스</span>
      </div>

      {/* 주요 지표 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 32 }}>
        {indicators.map(ind => {
          const isUp = ind.trend === "up";
          const isDown = ind.trend === "down";
          const trendColor = isUp ? "var(--green)" : isDown ? "var(--red)" : "var(--text-muted)";
          return (
            <div key={ind.label} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 14, padding: "18px 20px",
            }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>{ind.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{ind.value}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: trendColor, fontWeight: 600 }}>
                  {isUp ? "▲" : isDown ? "▼" : "─"} {ind.change}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ind.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 부동산 뉴스 */}
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>부동산 최신 뉴스</div>
      {news.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {news.map((n, i) => (
            <NewsCard key={i} news={n} />
          ))}
        </div>
      ) : (
        <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          뉴스를 불러오는 중입니다...
        </div>
      )}
    </div>
  );
}

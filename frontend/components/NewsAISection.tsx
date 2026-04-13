"use client";
import { useEffect, useState } from "react";
import { NewsAIData, NewsAIItem } from "@/types";
import SkeletonCard from "@/components/SkeletonCard";

const API = process.env.NEXT_PUBLIC_API_URL;

const SENTIMENT_CONFIG = {
  Bullish:  { label: "강세",  color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  Neutral:  { label: "중립",  color: "#eab308", bg: "rgba(234,179,8,0.1)"  },
  Bearish:  { label: "약세",  color: "#ef4444", bg: "rgba(239,68,68,0.1)"  },
};

const ITEM_SENTIMENT = {
  positive: { color: "#10b981", label: "긍정" },
  neutral:  { color: "#94a3b8", label: "중립" },
  negative: { color: "#ef4444", label: "부정" },
};

const CATEGORIES = ["전체", "주식", "코인", "부동산", "광물", "채권"];

export default function NewsAISection() {
  const [data, setData] = useState<NewsAIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("전체");

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/news-ai`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SkeletonCard height={180} />
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} height={80} />)}
      </div>
    );
  }

  if (!data) return null;

  const news = data.news ?? [];
  const themes = data.themes ?? [];

  // 데이터 준비 중 (빈 상태)
  if (news.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>—</div>
        <div style={{ fontSize: 14 }}>AI 뉴스 분석을 준비 중입니다</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>매 1시간마다 자동 갱신됩니다</div>
      </div>
    );
  }

  const sc = SENTIMENT_CONFIG[data.sentiment as keyof typeof SENTIMENT_CONFIG] ?? SENTIMENT_CONFIG.Neutral;
  const filtered = activeCategory === "전체"
    ? news
    : news.filter(n => n.category === activeCategory);

  return (
    <div>
      {/* AI 종합 분석 카드 */}
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "22px 24px",
        marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            AI News Intelligence
          </span>
          {data.summary && (
            <span style={{
              fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 20,
              background: sc.bg, color: sc.color, border: `1px solid ${sc.color}44`,
            }}>
              {sc.label} {data.sentiment_score}
            </span>
          )}
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
            {data.updated_at ? new Date(data.updated_at).toLocaleString("ko-KR") : ""}
          </span>
        </div>

        {/* 종합 요약 — AI 분석 완료 시만 표시 */}
        {data.summary ? (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 16 }}>
            {data.summary}
          </p>
        ) : (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            AI 분석을 준비 중입니다. 최신 뉴스는 아래에서 확인하세요.
          </p>
        )}

        {/* 핵심 테마 */}
        {themes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              핵심 테마
            </div>
            {themes.map((theme, i) => (
              <div key={i} style={{
                background: "var(--bg-2, var(--bg))",
                borderRadius: 10,
                padding: "12px 14px",
                borderLeft: "3px solid var(--accent)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>
                  {theme.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 6 }}>
                  {theme.detail}
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {theme.assets.map(asset => (
                    <span key={asset} style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 4,
                      background: "var(--accent-dim)", color: "var(--accent)",
                      border: "1px solid var(--accent-glow)",
                    }}>
                      {asset}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 카테고리 필터 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500,
              cursor: "pointer", transition: "all 0.15s",
              background: activeCategory === cat ? "var(--accent-dim)" : "var(--card)",
              color: activeCategory === cat ? "var(--accent)" : "var(--text-secondary)",
              border: activeCategory === cat ? "1px solid var(--accent-glow)" : "1px solid var(--border)",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 뉴스 목록 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((item, i) => <NewsAICard key={i} item={item} />)}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 13 }}>
            해당 카테고리의 뉴스가 없습니다
          </div>
        )}
      </div>
    </div>
  );
}

function NewsAICard({ item }: { item: NewsAIItem }) {
  const sc = ITEM_SENTIMENT[item.sentiment] ?? ITEM_SENTIMENT.neutral;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--card-hover)")}
      onMouseLeave={e => (e.currentTarget.style.background = "var(--card)")}
    >
      <div style={{ display: "flex", gap: 14, padding: "14px 16px", alignItems: "flex-start" }}>
        {/* 좌측 썸네일 */}
        {item.image_url && (
          <div style={{
            width: 130, height: 100, flexShrink: 0,
            borderRadius: 8, overflow: "hidden", background: "var(--border)",
          }}>
            <img
              src={item.image_url}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              onError={e => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = "none"; }}
            />
          </div>
        )}
        {/* 우측 컨텐츠 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
              background: "var(--accent-dim)", color: "var(--accent)",
              border: "1px solid var(--accent-glow)",
            }}>
              {item.category}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
              background: `${sc.color}15`, color: sc.color,
            }}>
              {sc.label}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.45, marginBottom: 6 }}>
            {item.title}
          </div>
          {item.ai_summary && (
            <div style={{
              fontSize: 12, color: "var(--accent)",
              background: "var(--accent-dim)", borderRadius: 6,
              padding: "4px 10px", marginBottom: 6, display: "inline-block",
              border: "1px solid var(--accent-glow)",
            }}>
              {item.ai_summary}
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {item.source} · {new Date(item.published_at).toLocaleDateString("ko-KR")}
          </div>
        </div>
      </div>
    </a>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SkeletonCard from "@/components/SkeletonCard";

const API = process.env.NEXT_PUBLIC_API_URL;

interface NewsTheme {
  title: string;
  detail: string;
  assets: string[];
}

interface NewsItem {
  title: string;
  url: string;
  source: string;
  published_at: string;
  category: string;
  sentiment: "positive" | "neutral" | "negative";
  ai_summary?: string;
  image_url?: string;
}

interface NewsAIData {
  sentiment: string;
  sentiment_score: number;
  summary: string;
  themes: NewsTheme[];
  news: NewsItem[];
  updated_at: string | null;
}

interface MarketDriver {
  headline: string;
  impact: string;
  direction: string;
  url?: string;
  source?: string;
  image_url?: string;
}

const SENTIMENT_CONFIG = {
  Bullish: { label: "강세", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  Neutral: { label: "중립", color: "#eab308", bg: "rgba(234,179,8,0.1)" },
  Bearish: { label: "약세", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

const ITEM_SENTIMENT = {
  positive: { color: "#10b981", label: "긍정" },
  neutral:  { color: "#94a3b8", label: "중립" },
  negative: { color: "#ef4444", label: "부정" },
};

const CATEGORIES = ["전체", "주식", "코인", "부동산", "광물", "채권", "한국"];

function fmtDate(): string {
  return new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
}

export default function TodayPicksPage() {
  const [data, setData]               = useState<NewsAIData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [activeCategory, setCategory] = useState("전체");
  const [theme, setTheme]             = useState<"dark" | "light">("light");
  const [drivers, setDrivers]         = useState<MarketDriver[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  useEffect(() => {
    fetch(`${API}/today-picks`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`${API}/market-driver`)
      .then(r => r.json())
      .then(data => setDrivers(data.drivers || []))
      .catch(() => {})
      .finally(() => setLoadingDrivers(false));
  }, []);

  const news   = data?.news   ?? [];
  const themes = data?.themes ?? [];
  const sc     = SENTIMENT_CONFIG[data?.sentiment as keyof typeof SENTIMENT_CONFIG] ?? SENTIMENT_CONFIG.Neutral;
  const filtered = activeCategory === "전체" ? news : news.filter(n => n.category === activeCategory);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* 헤더 */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 100,
        background: "var(--header-bg)", backdropFilter: "blur(16px)",
      }}>
        <div style={{
          maxWidth: 960, margin: "0 auto", padding: "0 24px",
          height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>W</span>
            </div>
            <div>
              <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.03em" }}>Whalyx</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Today&apos;s Picks
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={toggleTheme}
              style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 6, padding: "5px 10px", cursor: "pointer",
                fontSize: 10, fontWeight: 700, color: "var(--text-secondary)",
                letterSpacing: "0.06em",
              }}
            >
              {theme === "dark" ? "LIGHT" : "DARK"}
            </button>
            <Link href="/dashboard" style={{
              fontSize: 12, color: "var(--text-secondary)", textDecoration: "none",
              border: "1px solid var(--border)", borderRadius: 6,
              padding: "5px 12px", fontWeight: 500,
            }}>
              전체 대시보드 →
            </Link>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        {/* 타이틀 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>{fmtDate()}</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 10 }}>
            오늘의 투자포인트
          </h1>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Gemini AI 뉴스 분석
              {data?.updated_at && ` · ${new Date(data.updated_at).toLocaleString("ko-KR")} 갱신`}
            </span>
          </div>
        </div>

        {/* 오늘의 핵심 뉴스 3선 */}
        {(loadingDrivers || drivers.length > 0) && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                오늘의 핵심 뉴스
              </span>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20,
                background: "var(--accent)", color: "#fff", letterSpacing: "0.04em",
              }}>3</span>
            </div>
            {loadingDrivers ? (
              <div className="driver-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[0, 1, 2].map(i => <SkeletonCard key={i} height={200} />)}
              </div>
            ) : (
              <div className="driver-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {drivers.slice(0, 3).map((d, i) => <MarketDriverCard key={i} driver={d} rank={i + 1} />)}
              </div>
            )}
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SkeletonCard height={200} />
            {[0, 1, 2, 3, 4].map(i => <SkeletonCard key={i} height={90} />)}
          </div>
        )}

        {/* 준비 중 */}
        {!loading && news.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>—</div>
            <div style={{ fontSize: 14 }}>AI 뉴스 분석을 준비 중입니다</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>매 1시간마다 자동 갱신됩니다</div>
          </div>
        )}

        {/* 데이터 */}
        {!loading && news.length > 0 && (
          <>
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
                  AI Market Intelligence
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 20,
                  background: sc.bg, color: sc.color, border: `1px solid ${sc.color}44`,
                }}>
                  {sc.label} {data!.sentiment_score}
                </span>
              </div>

              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: themes.length > 0 ? 16 : 0 }}>
                {data!.summary}
              </p>

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
                  onClick={() => setCategory(cat)}
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
              {filtered.map((item, i) => <NewsCard key={i} item={item} />)}
              {filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  해당 카테고리의 뉴스가 없습니다
                </div>
              )}
            </div>
          </>
        )}

        {/* 하단 */}
        <div style={{
          textAlign: "center", marginTop: 32, paddingTop: 20,
          borderTop: "1px solid var(--border)",
        }}>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
            기관 투자자 포트폴리오, 코인, 부동산, 돈의 흐름 분석은 전체 대시보드에서
          </p>
          <Link href="/dashboard" style={{
            display: "inline-block", fontSize: 12, color: "var(--text-secondary)",
            border: "1px solid var(--border)", padding: "7px 20px",
            borderRadius: 20, textDecoration: "none",
          }}>
            전체 대시보드 보기
          </Link>
        </div>
      </main>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}

const DRIVER_DIRECTION: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  bullish: { label: "강세", color: "#10b981", bg: "rgba(16,185,129,0.07)", border: "rgba(16,185,129,0.25)", icon: "▲" },
  bearish: { label: "약세", color: "#ef4444", bg: "rgba(239,68,68,0.07)",  border: "rgba(239,68,68,0.25)",  icon: "▼" },
  mixed:   { label: "혼조", color: "#eab308", bg: "rgba(234,179,8,0.07)",  border: "rgba(234,179,8,0.25)",  icon: "◆" },
};

function MarketDriverCard({ driver, rank }: { driver: MarketDriver; rank: number }) {
  const dir = DRIVER_DIRECTION[driver.direction?.toLowerCase()] ?? DRIVER_DIRECTION.mixed;
  const Wrapper = driver.url ? "a" : ("div" as React.ElementType);
  const linkProps = driver.url
    ? { href: driver.url, target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <Wrapper
      {...linkProps}
      style={{
        display: "flex", flexDirection: "column",
        background: "var(--card)",
        border: `1px solid ${dir.border}`,
        borderRadius: 14,
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        transition: "transform 0.15s, box-shadow 0.15s",
        cursor: driver.url ? "pointer" : "default",
        position: "relative",
      }}
      onMouseEnter={driver.url ? (e: React.MouseEvent<HTMLElement>) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 8px 24px ${dir.color}18`;
      } : undefined}
      onMouseLeave={driver.url ? (e: React.MouseEvent<HTMLElement>) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      } : undefined}
    >
      {/* 썸네일 이미지 */}
      <div style={{
        width: "100%", height: 110, flexShrink: 0,
        background: dir.bg,
        position: "relative", overflow: "hidden",
      }}>
        {driver.image_url ? (
          <img
            src={driver.image_url}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={e => {
              const parent = (e.currentTarget as HTMLImageElement).parentElement;
              if (parent) parent.style.background = dir.bg;
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, color: dir.color, opacity: 0.25,
          }}>
            {dir.icon}
          </div>
        )}
        {/* 순위 뱃지 */}
        <div style={{
          position: "absolute", top: 8, left: 8,
          width: 22, height: 22, borderRadius: 6,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 800, color: "#fff",
        }}>
          {rank}
        </div>
        {/* 방향 뱃지 */}
        <div style={{
          position: "absolute", top: 8, right: 8,
          padding: "3px 8px", borderRadius: 6,
          background: `${dir.color}cc`, backdropFilter: "blur(4px)",
          fontSize: 10, fontWeight: 700, color: "#fff",
          display: "flex", alignItems: "center", gap: 3,
        }}>
          <span style={{ fontSize: 8 }}>{dir.icon}</span>
          {dir.label}
        </div>
      </div>

      {/* 텍스트 */}
      <div style={{ padding: "12px 14px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.45,
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
        }}>
          {driver.headline}
        </div>
        <div style={{
          fontSize: 11, color: "var(--text-secondary)",
          lineHeight: 1.5,
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {driver.impact}
        </div>
        {driver.source && (
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: "auto", paddingTop: 4 }}>
            {driver.source}
          </div>
        )}
      </div>
    </Wrapper>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
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
            {item.source}
            {item.published_at && ` · ${new Date(item.published_at).toLocaleDateString("ko-KR")}`}
          </div>
        </div>
      </div>
    </a>
  );
}

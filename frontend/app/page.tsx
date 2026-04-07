"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TodayPicksGrid from "@/components/TodayPicksGrid";
import SkeletonCard from "@/components/SkeletonCard";

const API = process.env.NEXT_PUBLIC_API_URL;

interface PickItem {
  ticker: string;
  name: string;
  price: number;
  change_pct: number;
  reason: string;
}

interface TodayPicksData {
  buy: PickItem[];
  sell: PickItem[];
  watch: PickItem[];
  generated_at: string;
  next_update: string;
}

function fmtUpdateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  } catch {
    return "";
  }
}

function fmtDate(): string {
  const d = new Date();
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

export default function TodayPicksPage() {
  const [data, setData] = useState<TodayPicksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("light");

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
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

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
          {/* 로고 */}
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

          {/* 우측 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={toggleTheme}
              style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 6, padding: "5px 10px", cursor: "pointer",
                fontSize: 10, fontWeight: 700, color: "var(--text-secondary)",
                transition: "all 0.15s", letterSpacing: "0.06em",
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
        {/* 날짜 + AI 갱신 배지 */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
            {fmtDate()}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 10 }}>
            오늘의 투자포인트
          </h1>
          {/* AI 갱신 배지 */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%", background: "#22c55e",
              animation: "pulse 2s infinite",
            }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Gemini AI · FinBERT 분석
              {data?.generated_at && ` · ${fmtUpdateTime(data.generated_at)} 갱신`}
            </span>
          </div>
        </div>

        {/* 로딩 스켈레톤 */}
        {loading && (
          <>
            {["buy", "sell", "watch"].map(s => (
              <div key={s} style={{ marginBottom: 28 }}>
                <div style={{ height: 16, width: 120, background: "var(--card)", borderRadius: 4, marginBottom: 12 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[0, 1, 2].map(i => <SkeletonCard key={i} height={160} />)}
                </div>
              </div>
            ))}
          </>
        )}

        {/* 에러 */}
        {!loading && error && (
          <div style={{
            textAlign: "center", padding: "60px 0", color: "var(--text-muted)",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>—</div>
            <div style={{ fontSize: 14 }}>데이터를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</div>
          </div>
        )}

        {/* 데이터 */}
        {!loading && data && (
          <>
            <TodayPicksGrid items={data.buy}   type="buy"   />
            <TodayPicksGrid items={data.sell}  type="sell"  />
            <TodayPicksGrid items={data.watch} type="watch" />
          </>
        )}

        {/* 하단 */}
        <div style={{
          textAlign: "center", marginTop: 24, paddingTop: 20,
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
        .fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  );
}

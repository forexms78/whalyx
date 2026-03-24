"use client";

import { useState } from "react";
import PortfolioInput from "@/components/PortfolioInput";
import Dashboard from "@/components/Dashboard";
import { AnalysisResult } from "@/types";

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (portfolio: string[]) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_request: "내 포트폴리오의 지정학 리스크를 분석해줘",
          portfolio,
        }),
      });
      if (!res.ok) throw new Error("분석 요청 실패");
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "var(--fb-bg)", minHeight: "100vh" }}>
      {/* 헤더 — Facebook 네비게이션 스타일 */}
      <header style={{
        background: "var(--fb-card)",
        borderBottom: "1px solid var(--fb-border)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "var(--fb-shadow)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              background: "var(--fb-blue)",
              borderRadius: 8,
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}>⚔️</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--fb-text-primary)" }}>War-Investment Agent</div>
              <div style={{ fontSize: 11, color: "var(--fb-text-secondary)" }}>지정학 리스크 포트폴리오 분석</div>
            </div>
          </div>
          <div style={{
            background: "var(--fb-blue-light)",
            color: "var(--fb-blue)",
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 12px",
            borderRadius: 20,
            border: "1px solid #B0CEFF",
          }}>
            ● 16 AI Agents Active
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        {!result && !loading && (
          <PortfolioInput onAnalyze={handleAnalyze} />
        )}

        {loading && (
          <div style={{
            background: "var(--fb-card)",
            borderRadius: 8,
            boxShadow: "var(--fb-shadow)",
            padding: 48,
            textAlign: "center",
          }}>
            <div style={{
              width: 48,
              height: 48,
              border: "4px solid var(--fb-border)",
              borderTopColor: "var(--fb-blue)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }} />
            <div style={{ fontWeight: 600, color: "var(--fb-text-primary)", marginBottom: 8 }}>OMS 팀 분석 중...</div>
            <div style={{ color: "var(--fb-text-secondary)", fontSize: 13 }}>PM → TPM → Supervisor 1/2/3 → 최종 리포트</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
          <div style={{
            background: "#FFF0F0",
            border: "1px solid #FFCDD2",
            borderRadius: 8,
            padding: 20,
            textAlign: "center",
          }}>
            <div style={{ color: "var(--fb-danger)", fontWeight: 600 }}>{error}</div>
            <button
              onClick={() => setError(null)}
              style={{ marginTop: 12, color: "var(--fb-blue)", background: "none", border: "none", cursor: "pointer", fontSize: 14 }}
            >
              다시 시도
            </button>
          </div>
        )}

        {result && <Dashboard result={result} onReset={() => setResult(null)} />}
      </main>
    </div>
  );
}

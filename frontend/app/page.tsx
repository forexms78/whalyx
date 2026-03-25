"use client";

import { useEffect, useState } from "react";
import { InvestorSummary, HotStock } from "@/types";
import InvestorCard from "@/components/InvestorCard";
import InvestorModal from "@/components/InvestorModal";
import HotStocks from "@/components/HotStocks";

export default function Home() {
  const [investors, setInvestors] = useState<InvestorSummary[]>([]);
  const [hotStocks, setHotStocks] = useState<HotStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvestor, setSelectedInvestor] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/investors`).then(r => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/stocks/hot`).then(r => r.json()),
    ]).then(([invData, stockData]) => {
      setInvestors(invData.investors || []);
      setHotStocks(stockData.stocks || []);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* 헤더 */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,14,26,0.95)", backdropFilter: "blur(12px)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700,
            }}>$</div>
            <div>
              <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em" }}>Smart Money</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>세계 최고 투자자들의 포트폴리오</span>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            실시간 뉴스 · NewsAPI · Gemini AI
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px" }}>
        {/* 히어로 섹션 */}
        <div style={{ marginBottom: 40, textAlign: "center" }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12, lineHeight: 1.2 }}>
            <span style={{ color: "var(--gold)" }}>세계 최고 투자자</span>들은<br />지금 무엇을 사고 있을까?
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-secondary)", maxWidth: 500, margin: "0 auto" }}>
            캐시 우드, 워런 버핏, 젠슨 황 등 8인의 최신 포트폴리오와<br />
            실시간 뉴스를 한눈에 확인하세요
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{
              width: 44, height: 44, border: "4px solid var(--border)",
              borderTopColor: "var(--accent)", borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
            }} />
            <div style={{ color: "var(--text-secondary)" }}>포트폴리오 데이터 로딩 중...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {/* 핫 종목 */}
            <HotStocks stocks={hotStocks} />

            {/* 투자자 그리드 */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 18, fontWeight: 700 }}>투자 거장 {investors.length}인</span>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16,
            }}>
              {investors.map(inv => (
                <InvestorCard
                  key={inv.id}
                  investor={inv}
                  onClick={() => setSelectedInvestor(inv.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {selectedInvestor && (
        <InvestorModal
          investorId={selectedInvestor}
          onClose={() => setSelectedInvestor(null)}
        />
      )}
    </div>
  );
}

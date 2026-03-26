"use client";

import { useEffect, useState } from "react";
import { InvestorDetail, StockDetail } from "@/types";
import StockModal from "./StockModal";

interface Props {
  investorId: string;
  onClose: () => void;
}

const ACTION_LABEL: Record<string, { label: string; color: string }> = {
  buy:  { label: "매수", color: "#10b981" },
  sell: { label: "매도", color: "#ef4444" },
  hold: { label: "보유", color: "#8892a4" },
};

export default function InvestorModal({ investorId, onClose }: Props) {
  const [data, setData] = useState<InvestorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/investors/${investorId}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [investorId]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "24px 16px", overflowY: "auto",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--card)", borderRadius: 16,
        border: "1px solid var(--border)",
        width: "100%", maxWidth: 800,
        minHeight: 200,
      }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text-secondary)" }}>
            <div style={{
              width: 36, height: 36, border: "3px solid var(--border)",
              borderTopColor: "var(--accent)", borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
            }} />
            포트폴리오 및 최신 뉴스 로딩 중...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : data ? (
          <>
            {/* 헤더 */}
            <div style={{
              padding: "20px 24px", borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: data.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 700, color: "#fff",
                }}>
                  {data.avatar_initial}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 18 }}>{data.name}</span>
                    {"style" in data && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px",
                        background: `${data.color}18`, color: data.color,
                        borderRadius: 6,
                      }}>{(data as InvestorDetail & { style: string }).style}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{data.title} · {data.firm}</div>
                </div>
              </div>
              <button onClick={onClose} style={{
                background: "var(--border)", border: "none", color: "var(--text-primary)",
                width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16,
              }}>✕</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* AI 인사이트 */}
              <div style={{
                background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
                borderRadius: 10, padding: 16, marginBottom: 24,
              }}>
                <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  AI 인사이트
                </div>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>{data.insight}</p>
              </div>

              {/* 포트폴리오 테이블 */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  포트폴리오
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {/* 컬럼 헤더 */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "80px 1fr 80px 90px 90px 60px",
                    padding: "6px 14px", marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>티커</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>종목명</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textAlign: "right" as const }}>현재가</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textAlign: "right" as const }}>30일 수익</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textAlign: "right" as const }}>비중</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textAlign: "center" as const }}>동향</span>
                  </div>
                  {data.portfolio.map(h => (
                    <div
                      key={h.ticker}
                      onClick={() => setSelectedStock(h.ticker)}
                      style={{
                        display: "grid", gridTemplateColumns: "80px 1fr 80px 90px 90px 60px",
                        alignItems: "center", padding: "10px 14px",
                        background: "var(--bg)", borderRadius: 8,
                        cursor: "pointer", transition: "background 0.15s",
                        border: "1px solid transparent",
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLDivElement).style.background = "var(--card-hover)";
                        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.background = "var(--bg)";
                        (e.currentTarget as HTMLDivElement).style.borderColor = "transparent";
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: 14 }}>{h.ticker}</span>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{h.name}</span>
                      <span style={{ fontSize: 13, textAlign: "right" }}>
                        {h.current_price ? `$${h.current_price.toLocaleString()}` : "-"}
                      </span>
                      <span style={{ fontSize: 13, textAlign: "right", color: h.change_30d_pct !== undefined && h.change_30d_pct !== null ? (h.change_30d_pct >= 0 ? "var(--green)" : "var(--red)") : "var(--text-muted)" }}>
                        {h.change_30d_pct !== undefined && h.change_30d_pct !== null ? `${h.change_30d_pct >= 0 ? "+" : ""}${h.change_30d_pct.toFixed(1)}% (30일)` : "-"}
                      </span>
                      <span style={{ fontSize: 12, textAlign: "right", color: "var(--text-muted)" }}>
                        비중 {h.weight}%
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, textAlign: "center", padding: "2px 8px",
                        borderRadius: 4, background: `${ACTION_LABEL[h.action]?.color}20`,
                        color: ACTION_LABEL[h.action]?.color,
                      }}>
                        {ACTION_LABEL[h.action]?.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 최신 뉴스 */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  최신 뉴스
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.news.slice(0, 5).map((n, i) => (
                    <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <div style={{
                        padding: "12px 14px", background: "var(--bg)", borderRadius: 8,
                        border: "1px solid var(--border)", transition: "border-color 0.15s",
                      }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)"}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"}
                      >
                        <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 4 }}>{n.title}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {n.source} · {n.published_at ? new Date(n.published_at).toLocaleDateString("ko-KR") : ""}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "var(--red)" }}>데이터를 불러올 수 없습니다.</div>
        )}
      </div>

      {selectedStock && (
        <StockModal ticker={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  );
}

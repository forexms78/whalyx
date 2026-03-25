"use client";

import { useEffect, useState } from "react";
import { StockDetail } from "@/types";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  ticker: string;
  onClose: () => void;
}

export default function StockModal({ ticker, onClose }: Props) {
  const [data, setData] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/stocks/${ticker}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [ticker]);

  const isUp = (data?.change_30d_pct ?? 0) >= 0;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--card)", borderRadius: 16,
        border: "1px solid var(--border)",
        width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto",
      }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text-secondary)" }}>
            <div style={{
              width: 32, height: 32, border: "3px solid var(--border)",
              borderTopColor: "var(--accent)", borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : data ? (
          <>
            {/* 헤더 */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 22, fontWeight: 700 }}>{ticker}</span>
                  <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{data.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
                  <span style={{ fontSize: 28, fontWeight: 700 }}>
                    {data.current_price ? `$${data.current_price.toLocaleString()}` : "-"}
                  </span>
                  {data.change_30d_pct !== undefined && (
                    <span style={{ fontSize: 15, color: isUp ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                      {isUp ? "+" : ""}{data.change_30d_pct.toFixed(2)}% (30일)
                    </span>
                  )}
                </div>
                {data.sector && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    {data.sector} · {data.industry}
                  </div>
                )}
              </div>
              <button onClick={onClose} style={{
                background: "var(--border)", border: "none", color: "var(--text-primary)",
                width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16,
              }}>✕</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* 차트 */}
              {data.chart && data.chart.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>30일 주가 차트</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={data.chart}>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#4a5568" }} axisLine={false} tickLine={false} />
                      <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#4a5568" }} axisLine={false} tickLine={false} width={60} />
                      <Tooltip
                        contentStyle={{ background: "#1a2235", border: "1px solid #1f2a3d", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, "가격"]}
                      />
                      <Line type="monotone" dataKey="price" stroke={isUp ? "#10b981" : "#ef4444"} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* AI 분석 */}
              <div style={{
                background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
                borderRadius: 10, padding: 14, marginBottom: 20,
              }}>
                <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>AI 분석</div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>{data.insight}</p>
              </div>

              {/* 뉴스 */}
              {data.news.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>최신 뉴스</div>
                  {data.news.slice(0, 4).map((n, i) => (
                    <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block", marginBottom: 8 }}>
                      <div style={{
                        padding: "10px 12px", background: "var(--bg)", borderRadius: 8,
                        border: "1px solid var(--border)",
                      }}>
                        <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.4 }}>{n.title}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                          {n.source} · {n.published_at ? new Date(n.published_at).toLocaleDateString("ko-KR") : ""}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "var(--red)" }}>데이터를 불러올 수 없습니다.</div>
        )}
      </div>
    </div>
  );
}

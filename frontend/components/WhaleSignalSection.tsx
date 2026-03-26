"use client";
import { WhaleSignal } from "@/types";

type Tab = "signal" | "stocks" | "crypto" | "realestate" | "commodities";

const ASSET_TAB_MAP: Record<string, Tab | null> = {
  "주식":   "stocks",
  "코인":   "crypto",
  "부동산": "realestate",
  "금/광물": "commodities",
  "채권":   null,
};

// 점수 → 라벨/색상 매핑
function scoreInfo(score: number) {
  if (score >= 75) return { label: "Strong Buy", color: "#10b981", bg: "rgba(16,185,129,0.1)" };
  if (score >= 55) return { label: "Buy",         color: "#22c55e", bg: "rgba(34,197,94,0.1)" };
  if (score >= 40) return { label: "Neutral",     color: "#eab308", bg: "rgba(234,179,8,0.1)" };
  if (score >= 25) return { label: "Avoid",       color: "#f97316", bg: "rgba(249,115,22,0.1)" };
  return              { label: "Super Sell",  color: "#ef4444", bg: "rgba(239,68,68,0.1)" };
}

// ── 반원형 게이지 SVG (스트로크 방식 — 하드코딩 색상으로 안정적 렌더링) ──
function SemiGauge({ score }: { score: number }) {
  const cx = 100, cy = 90, r = 68, sw = 14;

  // score → 반원 위 좌표: 0=왼쪽(9시), 100=오른쪽(3시), 50=위(12시)
  function arcPath(s1: number, s2: number): string {
    if (s1 >= s2) return "";
    const a1 = (1 - s1 / 100) * Math.PI;
    const a2 = (1 - s2 / 100) * Math.PI;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy - r * Math.sin(a2);
    const large = (s2 - s1) > 50 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }

  const zones = [
    { s1: 0,  s2: 25,  color: "#ef4444" },
    { s1: 25, s2: 40,  color: "#f97316" },
    { s1: 40, s2: 55,  color: "#eab308" },
    { s1: 55, s2: 75,  color: "#84cc16" },
    { s1: 75, s2: 100, color: "#10b981" },
  ];

  const info = scoreInfo(score);

  // 바늘 끝 좌표
  const na = (1 - score / 100) * Math.PI;
  const nLen = r - sw / 2 - 4;
  const nx = (cx + nLen * Math.cos(na)).toFixed(2);
  const ny = (cy - nLen * Math.sin(na)).toFixed(2);

  // 눈금 라벨 위치 (바깥쪽)
  const tickLabels = [
    { s: 0,  label: "SS" },
    { s: 50, label: "N" },
    { s: 100, label: "SB" },
  ];

  return (
    <svg viewBox="0 0 200 118" style={{ width: "100%", maxWidth: 200, display: "block" }}>
      {/* 배경 트랙 */}
      <path d={arcPath(0, 100)} fill="none" stroke="#d1dce8" strokeWidth={sw + 2} strokeLinecap="butt" />
      {/* 구역 색상 (연하게) */}
      {zones.map(z => (
        <path key={z.s1} d={arcPath(z.s1, z.s2)} fill="none" stroke={z.color} strokeWidth={sw} opacity={0.25} strokeLinecap="butt" />
      ))}
      {/* 현재 점수까지 진한 호 */}
      {score > 0 && (
        <path d={arcPath(0, score)} fill="none" stroke={info.color} strokeWidth={sw} strokeLinecap="round" />
      )}
      {/* 눈금 라벨 */}
      {tickLabels.map(t => {
        const ta = (1 - t.s / 100) * Math.PI;
        const lx = cx + (r + sw) * Math.cos(ta);
        const ly = cy - (r + sw) * Math.sin(ta);
        return (
          <text key={t.s} x={lx.toFixed(1)} y={ly.toFixed(1)} textAnchor="middle"
            fontSize={8} fill="#94a3b8" fontWeight="600">{t.label}</text>
        );
      })}
      {/* 바늘 */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={info.color} strokeWidth={2.5} strokeLinecap="round" />
      {/* 중앙 원 */}
      <circle cx={cx} cy={cy} r={7} fill={info.color} />
      <circle cx={cx} cy={cy} r={3} fill="#ffffff" />
      {/* 점수 */}
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize={26} fontWeight="800" fill={info.color}>{score}</text>
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize={9} fill="#94a3b8">/100</text>
    </svg>
  );
}

export default function WhaleSignalSection({
  data,
  onTabChange,
}: {
  data: WhaleSignal;
  onTabChange?: (tab: Tab) => void;
}) {
  // 전체 평균 점수
  const avgScore = data.signals.length
    ? Math.round(data.signals.reduce((s, a) => s + a.score, 0) / data.signals.length)
    : 50;
  const overall = scoreInfo(avgScore);

  return (
    <div style={{ marginBottom: 32 }}>
      {/* ── 상단 헤더 배너 ── */}
      <div className="whale-banner" style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "20px 24px",
        marginBottom: 16,
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 24,
        alignItems: "center",
      }}>
        {/* 왼쪽: 게이지 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 180 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>
            Whale Sentiment
          </div>
          <SemiGauge score={avgScore} />
          <span style={{
            fontSize: 13, fontWeight: 700, padding: "4px 14px", borderRadius: 20,
            background: overall.bg, color: overall.color,
            border: `1px solid ${overall.color}44`,
            marginTop: -4,
          }}>
            {overall.label}
          </span>
        </div>

        {/* 오른쪽: 요약 정보 */}
        <div>
          {/* 상단 메타 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Whale Signal
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Fed 기준금리 <strong style={{ color: "var(--text-secondary)" }}>{data.fed_rate}%</strong>
              <span style={{ marginLeft: 4, color: "var(--text-muted)" }}>(목표 3.50~3.75%)</span>
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {data.updated_at ? new Date(data.updated_at).toLocaleString("ko-KR") : ""}
            </span>
          </div>
          {/* 헤드라인 */}
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.35, marginBottom: 10, color: "var(--text-primary)" }}>
            {data.headline}
          </div>
          {/* AI 인사이트 */}
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            {data.ai_insight}
          </p>
          {/* 빠른 지표 바 */}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {data.signals.map(s => {
              const info = scoreInfo(s.score);
              return (
                <span key={s.asset} style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 20,
                  background: info.bg, color: info.color,
                  border: `1px solid ${info.color}33`,
                  fontWeight: 600,
                }}>
                  {s.asset} {s.badge ?? info.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 자산군별 신호 카드 ── */}
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
        자산군별 투자 신호
      </div>
      <div className="grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 32 }}>
        {data.signals.map((s) => {
          const targetTab = ASSET_TAB_MAP[s.asset];
          const info = scoreInfo(s.score);
          return (
            <div key={s.asset} style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "16px 18px",
              borderTop: `3px solid ${s.color}`,
              transition: "all 0.15s",
              cursor: targetTab ? "pointer" : "default",
            }}
              onClick={() => targetTab && onTabChange?.(targetTab)}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--card-hover)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--card)"; }}
            >
              {/* 자산명 + 뱃지 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{s.asset}</span>
                  {targetTab && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>↗</span>}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                  color: s.color, background: `${s.color}18`,
                  border: `1px solid ${s.color}44`,
                }}>
                  {s.badge ?? s.label}
                </span>
              </div>

              {/* 점수 바 */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                  <span>{s.label === "Super Sell" ? "매도 압력" : "투자 매력도"}</span>
                  <span style={{ color: s.color, fontWeight: 600 }}>{s.score}</span>
                </div>
                <div style={{ height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                  {s.label === "Super Sell" ? (
                    <div style={{
                      height: "100%", marginLeft: `${s.score}%`, width: `${100 - s.score}%`,
                      background: s.color, borderRadius: 3, transition: "all 0.6s ease",
                    }} />
                  ) : (
                    <div style={{
                      height: "100%", width: `${s.score}%`,
                      background: s.color, borderRadius: 3, transition: "width 0.6s ease",
                    }} />
                  )}
                </div>
              </div>

              {/* Super Sell: 매도 경고 */}
              {s.label === "Super Sell" && s.sell_warns && s.sell_warns.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: "#ef4444", marginBottom: 4, fontWeight: 600 }}>보유 시 매도 검토</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {s.sell_warns.map(w => (
                      <span key={w} style={{
                        fontSize: 10, padding: "2px 6px", borderRadius: 4,
                        background: "rgba(239,68,68,0.1)", color: "#ef4444",
                      }}>{w}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* 추천 종목 */}
              {s.label !== "Super Sell" && s.picks && s.picks.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {s.picks.slice(0, 3).map(p => (
                    <span key={p} style={{
                      fontSize: 10, padding: "2px 7px", borderRadius: 4,
                      background: "var(--bg)", color: "var(--text-secondary)",
                      border: "1px solid var(--border)",
                    }}>{p}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

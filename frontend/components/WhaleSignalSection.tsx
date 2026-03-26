"use client";
import { PieChart, Pie, Cell } from "recharts";
import { WhaleSignal } from "@/types";

type Tab = "signal" | "stocks" | "crypto" | "realestate" | "commodities" | "bonds";

const ASSET_TAB_MAP: Record<string, Tab | null> = {
  "주식":   "stocks",
  "코인":   "crypto",
  "부동산": "realestate",
  "금/광물": "commodities",
  "채권":   "bonds",
};

// 텍스트 내 투자 키워드 → 탭 매핑 (긴 것 먼저 — 부분 매칭 방지)
const KEYWORD_TAB: { keyword: string; tab: Tab }[] = [
  { keyword: "암호화폐", tab: "crypto" },
  { keyword: "비트코인", tab: "crypto" },
  { keyword: "금/광물",  tab: "commodities" },
  { keyword: "원자재",   tab: "commodities" },
  { keyword: "부동산",   tab: "realestate" },
  { keyword: "주식",     tab: "stocks" },
  { keyword: "코인",     tab: "crypto" },
  { keyword: "채권",     tab: "bonds" },
];

function renderLinkedText(
  text: string,
  onTabChange?: (tab: Tab) => void
): React.ReactNode {
  if (!onTabChange || !text) return text;

  const pattern = KEYWORD_TAB.map(k =>
    k.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  ).join("|");
  const regex = new RegExp(`(${pattern})`, "g");
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const mapping = KEYWORD_TAB.find(k => k.keyword === part);
    if (mapping) {
      return (
        <span
          key={i}
          onClick={() => onTabChange(mapping.tab)}
          style={{ cursor: "pointer" }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

// 점수 → 라벨/색상 매핑
function scoreInfo(score: number) {
  if (score >= 75) return { label: "Strong Buy", color: "#10b981", bg: "rgba(16,185,129,0.1)" };
  if (score >= 55) return { label: "Buy",         color: "#22c55e", bg: "rgba(34,197,94,0.1)" };
  if (score >= 40) return { label: "Neutral",     color: "#eab308", bg: "rgba(234,179,8,0.1)" };
  if (score >= 25) return { label: "Avoid",       color: "#f97316", bg: "rgba(249,115,22,0.1)" };
  return              { label: "Super Sell",  color: "#ef4444", bg: "rgba(239,68,68,0.1)" };
}

// ── 반원형 게이지 (recharts PieChart) ──
function SemiGauge({ score }: { score: number }) {
  const W = 200, H = 112;
  const CX = W / 2, CY = H;
  const OR = 82, IR = 54;
  const MR = (OR + IR) / 2;
  const SEGS = 20;
  const info = scoreInfo(score);
  const data = Array.from({ length: SEGS }, () => ({ v: 1 }));
  const filled = Math.round(score * SEGS / 100);

  function segColor(i: number): string {
    const t = i / (SEGS - 1);
    let R, G, B;
    if (t < 0.5) {
      const tt = t * 2;
      R = Math.round(59 + (139 - 59) * tt);
      G = Math.round(130 + (92 - 130) * tt);
      B = 246;
    } else {
      const tt = (t - 0.5) * 2;
      R = Math.round(139 + (239 - 139) * tt);
      G = Math.round(92 + (68 - 92) * tt);
      B = Math.round(246 + (68 - 246) * tt);
    }
    return `rgb(${R},${G},${B})`;
  }

  // 지시자 위치 계산 (score=0 → 좌측 끝, score=100 → 우측 끝)
  const angle = (1 - score / 100) * Math.PI;
  const ix = CX + MR * Math.cos(angle);
  const iy = CY - MR * Math.sin(angle);

  return (
    <div style={{ position: "relative", width: W, height: H }}>
      <PieChart width={W} height={H} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Pie
          data={data} dataKey="v"
          cx={CX} cy={CY}
          startAngle={180} endAngle={0}
          innerRadius={IR} outerRadius={OR}
          strokeWidth={0} isAnimationActive={false} paddingAngle={0.6}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={i < filled ? segColor(i) : "#d1dce8"} />
          ))}
        </Pie>
      </PieChart>
      {/* 위치 표시 원 */}
      <div style={{
        position: "absolute",
        left: ix, top: iy,
        transform: "translate(-50%, -50%)",
        width: 18, height: 18, borderRadius: "50%",
        background: "#ffffff", border: `3px solid ${info.color}`,
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        pointerEvents: "none", zIndex: 1,
      }} />
      {/* 점수 숫자 */}
      <div style={{
        position: "absolute", bottom: 10, left: 0, right: 0,
        textAlign: "center", fontSize: 30, fontWeight: 800,
        color: info.color, lineHeight: 1, pointerEvents: "none",
      }}>{score}</div>
      <div style={{ position: "absolute", bottom: 2, left: 10, fontSize: 10, color: "#94a3b8" }}>0</div>
      <div style={{ position: "absolute", bottom: 2, right: 10, fontSize: 10, color: "#94a3b8" }}>100</div>
    </div>
  );
}

export default function WhaleSignalSection({
  data,
  onTabChange,
}: {
  data: WhaleSignal;
  onTabChange?: (tab: string) => void;
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
            {renderLinkedText(data.headline, onTabChange)}
          </div>
          {/* AI 인사이트 */}
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            {renderLinkedText(data.ai_insight, onTabChange)}
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

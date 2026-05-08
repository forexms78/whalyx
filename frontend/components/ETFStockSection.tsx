"use client";

import { useEffect, useState } from "react";
import { ETFSignalsData, ETFSignalItem, ETFSignal, TrendPhase } from "@/types";
import SkeletonCard from "@/components/SkeletonCard";

const API = process.env.NEXT_PUBLIC_API_URL;

type Group = "etfs" | "us_stocks" | "kr_stocks";

const GROUPS: { id: Group; label: string; sub: string }[] = [
  { id: "etfs",      label: "ETF · 배당",   sub: "미장 인덱스 · SCHD · 한국 커버드콜 17종" },
  { id: "us_stocks", label: "미국 주식",     sub: "AAPL · NVDA · TSLA 등 12종" },
  { id: "kr_stocks", label: "한국 주식",     sub: "삼성전자 · 하이닉스 등 12종" },
];

const SIGNAL_META: Record<ETFSignal, { label: string; color: string; bg: string }> = {
  STRONG_BUY:  { label: "강력 매수", color: "#059669", bg: "#05966918" },
  BUY:         { label: "매수",      color: "#10b981", bg: "#10b98118" },
  HOLD:        { label: "관망",      color: "#6b7280", bg: "#6b728018" },
  SELL:        { label: "매도",      color: "#f59e0b", bg: "#f59e0b18" },
  STRONG_SELL: { label: "강력 매도", color: "#ef4444", bg: "#ef444418" },
};

function fmtPrice(item: ETFSignalItem): string {
  if (item.currency === "KRW") {
    return `₩${Math.round(item.current_price).toLocaleString("ko-KR")}`;
  }
  return `$${item.current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function chgColor(v: number | null | undefined): string {
  if (v == null) return "var(--text-muted)";
  return v >= 0 ? "var(--green)" : "var(--red)";
}

function fmtChg(v: number | null | undefined): string {
  if (v == null) return "-";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

interface Props {
  onSelect: (ticker: string) => void;
}

export default function ETFStockSection({ onSelect }: Props) {
  const [data, setData] = useState<ETFSignalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<Group>("etfs");

  useEffect(() => {
    fetch(`${API}/etf-signals`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const items: ETFSignalItem[] = data ? data[activeGroup] : [];

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
            매수·매도 타이밍 시그널
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            RSI · 52주 위치 · 이동평균 · AI 종합 판정
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          기술 지표 5종 + Gemini 2.5 Flash 종합 분석. 30분마다 갱신.
          {data?.updated_at && (
            <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>
              · 갱신 {new Date(data.updated_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {/* 그룹 토글 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {GROUPS.map(g => (
          <button
            key={g.id}
            onClick={() => setActiveGroup(g.id)}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: activeGroup === g.id ? "var(--accent-dim)" : "var(--card)",
              border: activeGroup === g.id ? "1px solid var(--accent-glow)" : "1px solid var(--border)",
              color: activeGroup === g.id ? "var(--accent)" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: activeGroup === g.id ? 700 : 500,
              transition: "all 0.15s",
              textAlign: "left",
            }}
          >
            <div>{g.label}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, fontWeight: 400 }}>
              {g.sub}
            </div>
          </button>
        ))}
      </div>

      {/* 카드 그리드 */}
      {loading || !data ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} height={210} />)}
        </div>
      ) : items.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          color: "var(--text-muted)", fontSize: 13,
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
        }}>
          시그널 데이터를 준비 중입니다. 잠시 후 새로고침해 주세요.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {items.map(item => <SignalCard key={item.ticker} item={item} onSelect={onSelect} />)}
        </div>
      )}
    </div>
  );
}


const PHASE_META: Record<TrendPhase, { label: string; arrow: string; color: string }> = {
  MARKUP:   { label: "상승", arrow: "↗", color: "var(--green)" },
  SIDEWAYS: { label: "횡보", arrow: "→", color: "var(--text-muted)" },
  MARKDOWN: { label: "하락", arrow: "↘", color: "var(--red)" },
};


function SignalCard({ item, onSelect }: { item: ETFSignalItem; onSelect: (t: string) => void }) {
  const meta = SIGNAL_META[item.signal];
  const phase = PHASE_META[item.trend_phase ?? "SIDEWAYS"];
  const isDanger = item.safety === "DANGER";

  return (
    <button
      onClick={() => onSelect(item.ticker)}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 16,
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.borderColor = meta.color + "60";
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.borderColor = "var(--border)";
        el.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            {item.ticker.replace(".KS", "").replace(".KQ", "")}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.name}
          </div>
        </div>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: meta.color,
          background: meta.bg,
          borderRadius: 999,
          padding: "3px 10px",
          flexShrink: 0,
        }}>
          {meta.label}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 19, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          {fmtPrice(item)}
        </span>
        <span style={{ fontSize: 12, color: chgColor(item.change_1y), fontWeight: 700 }}>
          {fmtChg(item.change_1y)} <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>1Y</span>
        </span>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 10, flexWrap: "wrap", lineHeight: 1.5 }}>
        <span>RSI <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{Math.round(item.rsi)}</span></span>
        <span>52w <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{Math.round(item.week52_pos)}%</span></span>
        <span>MA200 <span style={{ color: item.above_ma200 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{item.above_ma200 ? "↑" : "↓"}</span></span>
        <span style={{ color: phase.color, fontWeight: 700 }}>{phase.arrow} {phase.label}</span>
      </div>

      {isDanger && (
        <div style={{ fontSize: 10, color: "var(--red)", fontWeight: 700, letterSpacing: "0.04em", marginTop: 8 }}>
          DANGER · 과열 구간 신규 진입 주의
        </div>
      )}

      {item.reason && (
        <div style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          lineHeight: 1.45,
          marginTop: isDanger ? 6 : 10,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}>
          {item.reason}
        </div>
      )}
    </button>
  );
}

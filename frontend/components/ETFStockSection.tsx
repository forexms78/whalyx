"use client";

import { useEffect, useState } from "react";
import { ETFSignalsData, ETFSignalItem, ETFSignal } from "@/types";
import SkeletonCard from "@/components/SkeletonCard";

const API = process.env.NEXT_PUBLIC_API_URL;

type Group = "etfs" | "us_stocks" | "kr_stocks";

const GROUPS: { id: Group; label: string; sub: string }[] = [
  { id: "etfs",      label: "미장 대표 ETF", sub: "QQQ · SPY · VOO 등 10종" },
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


function SignalCard({ item, onSelect }: { item: ETFSignalItem; onSelect: (t: string) => void }) {
  const meta = SIGNAL_META[item.signal];

  return (
    <button
      onClick={() => onSelect(item.ticker)}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: 12,
        padding: 16,
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = "var(--card-hover)";
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = "var(--card)";
        el.style.transform = "translateY(0)";
      }}
    >
      {/* 상단: 티커 + 시그널 배지 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--accent)", letterSpacing: "-0.01em" }}>
            {item.ticker.replace(".KS", "").replace(".KQ", "")}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, fontWeight: 500 }}>
            {item.name}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
            {item.category}
          </div>
        </div>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: meta.color,
          background: meta.bg,
          border: `1px solid ${meta.color}40`,
          borderRadius: 6,
          padding: "3px 8px",
          flexShrink: 0,
        }}>
          {meta.label}
        </div>
      </div>

      {/* 가격 + 1년 수익률 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
          {fmtPrice(item)}
        </span>
        <span style={{ fontSize: 11, color: chgColor(item.change_1y), fontWeight: 600 }}>
          1Y {fmtChg(item.change_1y)}
        </span>
      </div>

      {/* 지표 그리드 */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px",
        marginBottom: 10, fontSize: 11,
      }}>
        <Indicator label="RSI(14)" value={item.rsi.toFixed(1)} color={
          item.rsi <= 30 ? "var(--green)" : item.rsi >= 70 ? "var(--red)" : "var(--text-primary)"
        } />
        <Indicator label="52주 위치" value={`${item.week52_pos.toFixed(0)}%`} color={
          item.week52_pos <= 30 ? "var(--green)" : item.week52_pos >= 90 ? "var(--red)" : "var(--text-primary)"
        } />
        <Indicator label="MA50" value={item.above_ma50 ? "위" : "아래"} color={
          item.above_ma50 ? "var(--green)" : "var(--red)"
        } />
        <Indicator label="MA200" value={item.above_ma200 ? "위" : "아래"} color={
          item.above_ma200 ? "var(--green)" : "var(--red)"
        } />
        <Indicator label="1M" value={fmtChg(item.change_1m)} color={chgColor(item.change_1m)} />
        <Indicator label="3M" value={fmtChg(item.change_3m)} color={chgColor(item.change_3m)} />
      </div>

      {/* AI 한 줄 근거 */}
      {item.reason && (
        <div style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
          padding: "8px 10px",
          background: "var(--bg-2)",
          borderRadius: 6,
          borderLeft: `2px solid ${meta.color}80`,
        }}>
          {item.reason}
        </div>
      )}
    </button>
  );
}


function Indicator({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 500 }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

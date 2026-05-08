"use client";

import { useEffect, useState } from "react";
import { ETFSignalsData, ETFSignalItem, ETFSignal, TrendPhase } from "@/types";
import SkeletonCard from "@/components/SkeletonCard";
import { useT } from "@/contexts/LanguageContext";

const API = process.env.NEXT_PUBLIC_API_URL;

type Group = "etfs" | "us_stocks" | "kr_stocks";

const SIGNAL_META: Record<ETFSignal, { color: string; bg: string }> = {
  STRONG_BUY:  { color: "#059669", bg: "#05966918" },
  BUY:         { color: "#10b981", bg: "#10b98118" },
  HOLD:        { color: "#6b7280", bg: "#6b728018" },
  SELL:        { color: "#f59e0b", bg: "#f59e0b18" },
  STRONG_SELL: { color: "#ef4444", bg: "#ef444418" },
};

const PHASE_META: Record<TrendPhase, { arrow: string; color: string }> = {
  MARKUP:   { arrow: "↗", color: "var(--green)" },
  SIDEWAYS: { arrow: "→", color: "var(--text-muted)" },
  MARKDOWN: { arrow: "↘", color: "var(--red)" },
};

function fmtPrice(item: ETFSignalItem, usdKrw?: number): { main: string; sub: string | null } {
  if (item.currency === "KRW") {
    const krw = Math.round(item.current_price);
    const usd = usdKrw ? item.current_price / usdKrw : null;
    return {
      main: `₩${krw.toLocaleString("ko-KR")}`,
      sub:  usd != null ? `$${usd.toFixed(2)}` : null,
    };
  }
  const usd = item.current_price;
  const krw = usdKrw ? Math.round(usd * usdKrw) : null;
  if (krw == null) {
    return { main: `$${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, sub: null };
  }
  return {
    main: `₩${krw.toLocaleString("ko-KR")}`,
    sub:  `$${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
  };
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
  usdKrw?: number;
  data?: ETFSignalsData | null;
}

export default function ETFStockSection({ onSelect, usdKrw, data: dataProp }: Props) {
  const { t, lang } = useT();
  const [data, setData] = useState<ETFSignalsData | null>(dataProp ?? null);
  const [loading, setLoading] = useState(!dataProp);
  const [activeGroup, setActiveGroup] = useState<Group>("etfs");

  const GROUPS: { id: Group; label: string; sub: string }[] = [
    { id: "etfs",      label: t("etf.group.etfs"), sub: t("etf.group.etfs.sub") },
    { id: "us_stocks", label: t("etf.group.us"),   sub: t("etf.group.us.sub")   },
    { id: "kr_stocks", label: t("etf.group.kr"),   sub: t("etf.group.kr.sub")   },
  ];

  // dashboard에서 prefetch한 데이터를 prop으로 받으면 즉시 표시.
  // prop 없을 때만 fallback fetch.
  useEffect(() => {
    if (dataProp) {
      setData(dataProp);
      setLoading(false);
      return;
    }
    if (data) return;
    fetch(`${API}/etf-signals`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [dataProp]);

  const items: ETFSignalItem[] = data ? data[activeGroup] : [];

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {t("etf.title")}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {t("etf.subtitle")}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          {t("etf.description")}
          {data?.updated_at && (
            <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>
              · {t("etf.updated")} {new Date(data.updated_at).toLocaleString(lang === "ko" ? "ko-KR" : "en-US", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

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
          {t("etf.empty")}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {items.map(item => <SignalCard key={item.ticker} item={item} onSelect={onSelect} usdKrw={usdKrw} />)}
        </div>
      )}
    </div>
  );
}


function SignalCard({ item, onSelect, usdKrw }: { item: ETFSignalItem; onSelect: (t: string) => void; usdKrw?: number }) {
  const { t } = useT();
  const meta = SIGNAL_META[item.signal];
  const phase = PHASE_META[item.trend_phase ?? "SIDEWAYS"];
  const isDanger = item.safety === "DANGER";
  const price = fmtPrice(item, usdKrw);

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
          {t(`signal.${item.signal}`)}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 19, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          {price.main}
        </span>
        {price.sub && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
            {price.sub}
          </span>
        )}
        <span style={{ fontSize: 12, color: chgColor(item.change_1y), fontWeight: 700, marginLeft: "auto" }}>
          {fmtChg(item.change_1y)} <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>1Y</span>
        </span>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 10, flexWrap: "wrap", lineHeight: 1.5 }}>
        <span>RSI <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{Math.round(item.rsi)}</span></span>
        <span>52w <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{Math.round(item.week52_pos)}%</span></span>
        <span>MA200 <span style={{ color: item.above_ma200 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{item.above_ma200 ? "↑" : "↓"}</span></span>
        <span style={{ color: phase.color, fontWeight: 700 }}>
          {phase.arrow} {t(`phase.${item.trend_phase ?? "SIDEWAYS"}`)}
        </span>
      </div>

      {isDanger && (
        <div style={{ fontSize: 10, color: "var(--red)", fontWeight: 700, letterSpacing: "0.04em", marginTop: 8 }}>
          {t("danger.label")}
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

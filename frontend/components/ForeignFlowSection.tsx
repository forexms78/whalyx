"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

type MarketKey = "kospi" | "kosdaq";

interface TopItem {
  ticker: string;
  name: string;
  net_buy_volume: number;       // 천주
  net_buy_value_mil: number;    // 백만원 (네이버 노출 수치 그대로)
  today_volume: number;
}

interface MarketToday {
  bizdate?: string;
  personal?: number;            // 백만원
  foreign?: number;
  institutional?: number;
}

interface ForeignFlowData {
  top_buyers:  Record<MarketKey, TopItem[]>;
  top_sellers: Record<MarketKey, TopItem[]>;
  market_today:   Record<MarketKey, MarketToday>;
  market_history: Record<MarketKey, { date: string; personal: number; foreign: number; institutional: number }[]>;
  updated_at: string | null;
}

interface Props {
  onSelect?: (ticker: string) => void;
}

function fmtMil(mil: number | undefined): string {
  if (mil == null) return "-";
  const v = Math.abs(mil);
  const sign = mil >= 0 ? "+" : "-";
  if (v >= 10_000) return `${sign}${(v / 10_000).toFixed(2)}조`;      // 1만 백만원 = 1조
  if (v >= 100)    return `${sign}${(v / 100).toFixed(0)}억`;         // 100 백만원 = 1억
  return `${sign}${v.toLocaleString()}백만`;
}

function colorOf(v: number | undefined): string {
  if (v == null || v === 0) return "var(--text-muted)";
  return v > 0 ? "var(--green)" : "var(--red)";
}

export default function ForeignFlowSection({ onSelect }: Props) {
  const [data, setData]       = useState<ForeignFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [market, setMarket]   = useState<MarketKey>("kospi");

  useEffect(() => {
    let alive = true;
    fetch(`${API}/foreign-flow`)
      .then(r => r.json())
      .then((d: ForeignFlowData) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13 }}>
        외국인 매매 데이터를 불러오는 중...
      </div>
    );
  }
  if (!data) return null;

  const today   = data.market_today?.[market]   || {};
  const buyers  = data.top_buyers?.[market]     || [];
  const sellers = data.top_sellers?.[market]    || [];
  const history = data.market_history?.[market] || [];

  const Pill = ({ label, value, active, onClick }: { label: string; value: MarketKey; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        background:   active ? "var(--accent-dim)" : "transparent",
        border:       active ? "1px solid var(--accent-glow)" : "1px solid var(--border)",
        color:        active ? "var(--accent)" : "var(--text-secondary)",
        padding:      "6px 16px", borderRadius: 20, cursor: "pointer",
        fontSize:     12, fontWeight: active ? 600 : 400,
        transition:   "all 0.15s",
      }}
    >{label}</button>
  );

  const StatBox = ({ label, value }: { label: string; value: number | undefined }) => (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "12px 14px", flex: 1,
    }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: colorOf(value) }}>{fmtMil(value)}</div>
    </div>
  );

  const Row = ({ item, side }: { item: TopItem; side: "buy" | "sell" }) => {
    const isBuy = side === "buy";
    const color = isBuy ? "var(--green)" : "var(--red)";
    const display = isBuy ? item.net_buy_value_mil : -Math.abs(item.net_buy_value_mil);
    const Tag = onSelect && item.ticker ? "button" : "div";
    return (
      <Tag
        onClick={onSelect && item.ticker ? () => onSelect(item.ticker) : undefined}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 12px", border: "1px solid var(--border)",
          borderRadius: 8, background: "var(--card)", width: "100%",
          textAlign: "left", cursor: onSelect && item.ticker ? "pointer" : "default",
          transition: "all 0.15s",
        }}
        onMouseEnter={onSelect && item.ticker ? e => {
          (e.currentTarget as HTMLElement).style.borderColor = color;
          (e.currentTarget as HTMLElement).style.background = "var(--card-hover)";
        } : undefined}
        onMouseLeave={onSelect && item.ticker ? e => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLElement).style.background = "var(--card)";
        } : undefined}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.name}
          </div>
          {item.ticker && (
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.ticker}</div>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color, marginLeft: 12, whiteSpace: "nowrap" }}>
          {fmtMil(display)}
        </div>
      </Tag>
    );
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          외국인 매매 동향
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400, marginLeft: 8 }}>
            네이버 금융 · 장 마감 후 갱신
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Pill label="KOSPI"  value="kospi"  active={market === "kospi"}  onClick={() => setMarket("kospi")} />
          <Pill label="KOSDAQ" value="kosdaq" active={market === "kosdaq"} onClick={() => setMarket("kosdaq")} />
        </div>
      </div>

      {/* 시장 합계 (당일) */}
      {today.bizdate && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.04em" }}>
            시장 전체 순매수 ({today.bizdate}) · 단위 환산
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <StatBox label="외국인" value={today.foreign} />
            <StatBox label="기관"   value={today.institutional} />
            <StatBox label="개인"   value={today.personal} />
          </div>
          {history.length >= 2 && (
            <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-muted)" }}>
              · 시계열 누적: 최근 {history.length}일분 (매일 KST 16:30 추가)
            </div>
          )}
        </div>
      )}

      {/* 종목 TOP */}
      <div className="foreign-flow-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{
            fontSize: 12, fontWeight: 600, color: "var(--green)",
            marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)" }} />
            외국인 순매수 TOP ({buyers.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {buyers.slice(0, 10).map((it, i) => <Row key={`b${i}-${it.ticker || it.name}`} item={it} side="buy" />)}
            {!buyers.length && <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 12px" }}>데이터 없음</div>}
          </div>
        </div>
        <div>
          <div style={{
            fontSize: 12, fontWeight: 600, color: "var(--red)",
            marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--red)" }} />
            외국인 순매도 TOP ({sellers.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sellers.slice(0, 10).map((it, i) => <Row key={`s${i}-${it.ticker || it.name}`} item={it} side="sell" />)}
            {!sellers.length && <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 12px" }}>데이터 없음</div>}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 720px) {
          .foreign-flow-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

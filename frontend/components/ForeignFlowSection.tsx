"use client";

import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

type MarketKey = "kospi" | "kosdaq";

interface TopItem {
  ticker: string;
  name: string;
  net_buy_volume: number;       // 천주
  net_buy_value_mil: number;    // 백만원
  today_volume?: number;
}

interface MarketDay {
  date?: string;
  bizdate?: string;
  personal: number;
  foreign: number;
  institutional: number;
}

interface ForeignFlowData {
  top_buyers:  Record<MarketKey, TopItem[]>;       // 최신일 (back-compat)
  top_sellers: Record<MarketKey, TopItem[]>;
  market_today: Record<MarketKey, MarketDay>;
  market_history: Record<MarketKey, MarketDay[]>;
  top_history: Record<MarketKey, Record<string, { buyers: TopItem[]; sellers: TopItem[] }>>;
  available_dates: string[];    // 최신 순
  current_date: string | null;
  updated_at: string | null;
}

function fmtMil(mil: number | undefined): string {
  if (mil == null) return "-";
  const v = Math.abs(mil);
  const sign = mil >= 0 ? "+" : "-";
  if (v >= 10_000) return `${sign}${(v / 10_000).toFixed(2)}조`;
  if (v >= 100)    return `${sign}${(v / 100).toFixed(0)}억`;
  return `${sign}${v.toLocaleString()}백만`;
}

function colorOf(v: number | undefined): string {
  if (v == null || v === 0) return "var(--text-muted)";
  return v > 0 ? "var(--green)" : "var(--red)";
}

function fmtDateKo(iso: string): string {
  // "2026-05-15" → "2026년 5월 15일 (금)"
  const d = new Date(iso + "T00:00:00+09:00");
  if (isNaN(d.getTime())) return iso;
  const wk = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${wk})`;
}

export default function ForeignFlowSection() {
  const [data, setData]       = useState<ForeignFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [market, setMarket]   = useState<MarketKey>("kospi");
  const [date, setDate]       = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API}/foreign-flow`)
      .then(r => r.json())
      .then((d: ForeignFlowData) => {
        if (!alive) return;
        setData(d);
        setDate(d.current_date || (d.available_dates?.[0] ?? null));
        setLoading(false);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // 선택된 날짜·시장의 종목 TOP — top_history 우선, 없으면(현재 날짜) 최신 top_buyers/sellers
  const { buyers, sellers } = useMemo(() => {
    if (!data || !date) return { buyers: [] as TopItem[], sellers: [] as TopItem[] };
    const hist = data.top_history?.[market]?.[date];
    if (hist) return { buyers: hist.buyers || [], sellers: hist.sellers || [] };
    // 최신일이면 top_buyers/top_sellers fallback (history에 아직 안 들어갔을 수 있음)
    if (date === data.current_date) {
      return { buyers: data.top_buyers?.[market] || [], sellers: data.top_sellers?.[market] || [] };
    }
    return { buyers: [], sellers: [] };
  }, [data, market, date]);

  const todayMarket = useMemo(() => {
    if (!data || !date) return null;
    const histRow = (data.market_history?.[market] || []).find(r => r.date === date);
    if (histRow) return histRow;
    if (date === data.current_date) {
      const t = data.market_today?.[market];
      if (t) return { date: t.bizdate, personal: t.personal, foreign: t.foreign, institutional: t.institutional };
    }
    return null;
  }, [data, market, date]);

  if (loading) {
    return (
      <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13 }}>
        외국인 매매 데이터를 불러오는 중...
      </div>
    );
  }
  if (!data) return null;

  const dates = data.available_dates || (data.current_date ? [data.current_date] : []);
  const marketHistLen = (data.market_history?.[market] || []).length;

  const Pill = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
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
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 12px", border: "1px solid var(--border)",
        borderRadius: 8, background: "var(--card)", width: "100%",
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {item.name}
          </div>
          {item.ticker && (
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.ticker}</div>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color, marginLeft: 12, whiteSpace: "nowrap" }}>
          {fmtMil(display)}
        </div>
      </div>
    );
  };

  const currentIdx = dates.indexOf(date || "");
  const goPrev = () => { if (currentIdx >= 0 && currentIdx < dates.length - 1) setDate(dates[currentIdx + 1]); };
  const goNext = () => { if (currentIdx > 0) setDate(dates[currentIdx - 1]); };

  return (
    <div style={{ marginBottom: 32 }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          외국인 매매 동향
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          네이버 금융 데이터 · 매일 KST 16:30 / 17:30 자동 누적
        </div>
      </div>

      {/* 컨트롤 — KOSPI/KOSDAQ + 날짜 선택 */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
        marginBottom: 16, padding: "12px 14px",
        border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)",
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          <Pill label="KOSPI"  active={market === "kospi"}  onClick={() => setMarket("kospi")} />
          <Pill label="KOSDAQ" active={market === "kosdaq"} onClick={() => setMarket("kosdaq")} />
        </div>

        <div style={{ flex: 1, minWidth: 220, display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
          <button
            onClick={goPrev}
            disabled={currentIdx >= dates.length - 1 || currentIdx < 0}
            style={{
              background: "transparent", border: "1px solid var(--border)",
              borderRadius: 6, padding: "6px 10px", fontSize: 12,
              color: "var(--text-secondary)",
              cursor: currentIdx >= dates.length - 1 || currentIdx < 0 ? "not-allowed" : "pointer",
              opacity: currentIdx >= dates.length - 1 || currentIdx < 0 ? 0.4 : 1,
            }}
          >◀ 이전일</button>

          <select
            value={date || ""}
            onChange={e => setDate(e.target.value)}
            style={{
              background: "var(--card)", color: "var(--text-primary)",
              border: "1px solid var(--border)", borderRadius: 6,
              padding: "6px 10px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", minWidth: 180,
            }}
          >
            {dates.length === 0 && <option value="">데이터 없음</option>}
            {dates.map(d => (
              <option key={d} value={d}>{fmtDateKo(d)}</option>
            ))}
          </select>

          <button
            onClick={goNext}
            disabled={currentIdx <= 0}
            style={{
              background: "transparent", border: "1px solid var(--border)",
              borderRadius: 6, padding: "6px 10px", fontSize: 12,
              color: "var(--text-secondary)",
              cursor: currentIdx <= 0 ? "not-allowed" : "pointer",
              opacity: currentIdx <= 0 ? 0.4 : 1,
            }}
          >다음일 ▶</button>
        </div>
      </div>

      {/* 기준일 명시 + 데이터 없음 안내 */}
      {!todayMarket && !buyers.length && !sellers.length && (
        <div style={{
          padding: "20px 16px", border: "1px dashed var(--border)", borderRadius: 10,
          color: "var(--text-muted)", fontSize: 13, textAlign: "center",
        }}>
          선택한 날짜의 데이터가 누적되지 않았습니다. (서비스 시작 이전 날짜)
        </div>
      )}

      {/* 시장 합계 카드 */}
      {todayMarket && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.04em" }}>
            시장 전체 순매수 · 기준일 <strong style={{ color: "var(--text-secondary)" }}>{fmtDateKo(date || "")}</strong>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <StatBox label="외국인" value={todayMarket.foreign} />
            <StatBox label="기관"   value={todayMarket.institutional} />
            <StatBox label="개인"   value={todayMarket.personal} />
          </div>
          {marketHistLen >= 2 && (
            <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-muted)" }}>
              · 시장 합계 시계열 누적: 최근 {marketHistLen}일분
            </div>
          )}
        </div>
      )}

      {/* 종목 TOP */}
      {(buyers.length > 0 || sellers.length > 0) && (
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
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 720px) {
          .foreign-flow-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

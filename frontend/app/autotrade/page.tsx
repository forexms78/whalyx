"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SignalBadge from "@/components/quant/SignalBadge";
import PasswordGate from "@/components/quant/PasswordGate";
import WatchlistManager from "@/components/autotrade/WatchlistManager";

interface AccountSummary {
  cash: number;
  deposit_total: number;
  total_eval: number;
  buy_total: number;
  eval_total: number;
  pnl_amount: number;
  pnl_pct: number;
  today_buy: number;
  today_sell: number;
  net_asset: number;
  error?: string;
}

interface Status {
  system_on: boolean;
  trades_today: number;
  total_invested: number;
  total_pnl_pct: number;
  holdings: Holding[];
}

interface Holding {
  ticker: string;
  name: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  pnl_pct: number;
}

interface TradeDetails {
  ma5?: number;
  ma20?: number;
  rsi?: number;
  macd_ok?: boolean;
  vol_ok?: boolean;
  mtf_ok?: boolean;
  per?: number;
  pbr?: number;
  pos_mult?: number;
  financial_filter_passed?: boolean;
  financial_filter_reason?: string;
  news_sentiment?: number;
  news_category?: string;
  amount_invested?: number;
  pnl_pct?: number;
  trailing_activated?: boolean;
}

interface Trade {
  id: number;
  ticker: string;
  action: string;
  price: number;
  quantity: number;
  amount: number;
  reason: string;
  market?: string;
  executed_at: string;
  details?: TradeDetails;
}

interface WsNotification {
  ticker: string;
  action: string;
  price: number;
  quantity: number;
  reason: string;
  market: string;
}

interface Signal {
  ticker: string;
  name: string;
  market: string;
  source: string;
  signal: string;
  current_price?: number;
  ma5?: number;
  ma20?: number;
  rsi?: number;
  macd_ok?: boolean;
  vol_ok?: boolean;
  mtf_ok?: boolean;
  per?: number;
  reason?: string;
  note?: string;
}

interface BacktestResult {
  ticker: string;
  market: string;
  total_return: number;
  sharpe: number | null;
  mdd: number;
  win_rate: number;
  trade_count: number;
  avg_hold_days: number;
  ready_for_live: boolean;
  verdict: string;
  error?: string;
}

const API = process.env.NEXT_PUBLIC_API_URL;

const REASON_LABEL: Record<string, string> = {
  signal_buy: "시그널 매수",
  stop_loss: "손절 자동 매도",
  take_profit: "익절",
};

function AutoTradeContent() {
  const [status,       setStatus]       = useState<Status | null>(null);
  const [account,      setAccount]      = useState<AccountSummary | null>(null);
  const [trades,       setTrades]       = useState<Trade[]>([]);
  const [signals,      setSignals]      = useState<Signal[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<"signals" | "backtest">("signals");
  const [btTicker,     setBtTicker]     = useState("");
  const [btMarket,     setBtMarket]     = useState("KR");
  const [btResult,     setBtResult]     = useState<BacktestResult | null>(null);
  const [btLoading,    setBtLoading]    = useState(false);
  const [expandedId,   setExpandedId]   = useState<number | null>(null);
  const [wsNotif,      setWsNotif]      = useState<WsNotification | null>(null);
  const [wsConnected,  setWsConnected]  = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/autotrade/status`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/autotrade/account`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/autotrade/trades`).then((r) => r.json()).catch(() => []),
      fetch(`${API}/autotrade/signals`).then((r) => r.json()).catch(() => []),
    ]).then(([s, acc, t, sig]) => {
      setStatus(s);
      setAccount(acc?.error ? null : acc);
      setTrades(Array.isArray(t) ? t : []);
      setSignals(Array.isArray(sig) ? sig : []);
      setLoading(false);
    });
  }, []);

  // WebSocket 연결
  useEffect(() => {
    if (!API) return;
    const wsUrl = API.replace(/^https?/, (m) => (m === "https" ? "wss" : "ws")) + "/ws/signals";
    let ws: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        retryTimer = setTimeout(connect, 5000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "trade") {
            setWsNotif(data as WsNotification);
            // 체결 이력 실시간 갱신
            fetch(`${API}/autotrade/trades`).then(r => r.json()).then(t => setTrades(Array.isArray(t) ? t : [])).catch(() => {});
            // 3초 후 알림 제거
            setTimeout(() => setWsNotif(null), 5000);
          }
        } catch { /* ignore */ }
      };
    }
    connect();
    return () => {
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  async function runBacktest() {
    if (!btTicker.trim()) return;
    setBtLoading(true);
    setBtResult(null);
    try {
      const res = await fetch(`${API}/autotrade/backtest/${btTicker.trim().toUpperCase()}?market=${btMarket}&days=180`);
      setBtResult(await res.json());
    } catch { setBtResult({ ticker: btTicker, market: btMarket, total_return: 0, sharpe: null, mdd: 0, win_rate: 0, trade_count: 0, avg_hold_days: 0, ready_for_live: false, verdict: "오류", error: "요청 실패" }); }
    finally { setBtLoading(false); }
  }

  const systemOn = status?.system_on ?? false;
  const pnl = status?.total_pnl_pct ?? 0;
  const pnlColor = pnl >= 0 ? "var(--green)" : "var(--red)";

  const statCards = [
    {
      label: "시스템 상태",
      value: loading ? "..." : systemOn ? "실행 중" : "오프라인",
      color: loading ? "var(--text-muted)" : systemOn ? "var(--green)" : "var(--red)",
      dot: true,
    },
    {
      label: "오늘 체결",
      value: `${status?.trades_today ?? 0}건`,
      color: "var(--text-primary)",
      dot: false,
    },
    {
      label: "투자 중 금액",
      value: status?.total_invested ? `${Math.round(status.total_invested / 10000)}만원` : "-",
      color: "var(--accent)",
      dot: false,
    },
    {
      label: "오늘 수익률",
      value: status?.total_pnl_pct != null ? `${pnl > 0 ? "+" : ""}${pnl}%` : "-",
      color: pnlColor,
      dot: false,
    },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)", fontFamily: "inherit" }}>
        <header style={{
          borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100,
          background: "var(--header-bg)", backdropFilter: "blur(16px)",
        }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>W</span>
              </div>
              <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em" }}>Whalyx</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>Quant</span>
            </div>
          </div>
        </header>

        {/* 진행 바 */}
        <div style={{ position: "fixed", top: 56, left: 0, right: 0, height: 2, zIndex: 200, overflow: "hidden", background: "var(--border)" }}>
          <div style={{
            height: "100%", background: "var(--accent)",
            animation: "loadingBar 1.8s ease-in-out infinite",
            transformOrigin: "left",
          }} />
        </div>
        <style>{`
          @keyframes loadingBar {
            0%   { transform: translateX(-100%) scaleX(0.3); }
            50%  { transform: translateX(30%)   scaleX(0.6); }
            100% { transform: translateX(100%)  scaleX(0.3); }
          }
          @keyframes shimmer {
            0%   { background-position: -400px 0; }
            100% { background-position: 400px 0; }
          }
        `}</style>

        <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <div style={{ width: 200, height: 24, borderRadius: 6, background: "var(--card)", animation: "shimmer 1.4s infinite linear", backgroundImage: "linear-gradient(90deg, var(--card) 0%, var(--card-hover) 50%, var(--card) 100%)", backgroundSize: "800px 100%" }} />
            <div style={{ width: 360, height: 14, borderRadius: 4, background: "var(--card)", marginTop: 8, animation: "shimmer 1.4s infinite linear", backgroundImage: "linear-gradient(90deg, var(--card) 0%, var(--card-hover) 50%, var(--card) 100%)", backgroundSize: "800px 100%" }} />
          </div>

          {/* 스켈레톤 상태 카드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ width: 80, height: 11, borderRadius: 4, marginBottom: 14, background: "var(--card-hover)", animation: "shimmer 1.4s infinite linear", backgroundImage: "linear-gradient(90deg, var(--card-hover) 0%, var(--border) 50%, var(--card-hover) 100%)", backgroundSize: "800px 100%" }} />
                <div style={{ width: 60, height: 22, borderRadius: 5, background: "var(--card-hover)", animation: "shimmer 1.4s infinite linear", backgroundImage: "linear-gradient(90deg, var(--card-hover) 0%, var(--border) 50%, var(--card-hover) 100%)", backgroundSize: "800px 100%" }} />
              </div>
            ))}
          </div>

          {/* 스켈레톤 테이블 */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 100, height: 14, borderRadius: 4, background: "var(--card-hover)" }} />
              <div style={{ width: 160, height: 12, borderRadius: 4, background: "var(--card-hover)" }} />
            </div>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ width: `${80 + Math.random() * 60}px`, height: 13, borderRadius: 4, background: "var(--card-hover)", marginBottom: 6, animation: `shimmer ${1.2 + i * 0.1}s infinite linear`, backgroundImage: "linear-gradient(90deg, var(--card-hover) 0%, var(--border) 50%, var(--card-hover) 100%)", backgroundSize: "800px 100%" }} />
                  <div style={{ width: 60, height: 10, borderRadius: 3, background: "var(--card-hover)" }} />
                </div>
                {[50, 70, 70, 40, 80].map((w, j) => (
                  <div key={j} style={{ width: w, height: 12, borderRadius: 3, background: "var(--card-hover)", animation: `shimmer ${1.3 + j * 0.1}s infinite linear`, backgroundImage: "linear-gradient(90deg, var(--card-hover) 0%, var(--border) 50%, var(--card-hover) 100%)", backgroundSize: "800px 100%" }} />
                ))}
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", padding: "8px 0", color: "var(--text-muted)", fontSize: 12 }}>
            KIS API에서 종목 데이터 수신 중 · 25개 종목 순차 조회 (약 30~60초 소요)
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)", fontFamily: "inherit" }}>

      {/* 헤더 */}
      <header style={{
        borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100,
        background: "var(--header-bg)", backdropFilter: "blur(16px)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/dashboard" style={{
              width: 30, height: 30, borderRadius: 8, background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
            }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>W</span>
            </Link>
            <Link href="/dashboard" style={{ textDecoration: "none", color: "inherit" }}>
              <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em" }}>Whalyx</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>Quant</span>
            </Link>
          </div>
          <nav style={{ display: "flex", gap: 4 }}>
            {[
              { href: "/quant", label: "리서치 저널", active: false },
              { href: "/autotrade", label: "자동매매", active: true },
            ].map(({ href, label, active }) => (
              <Link key={href} href={href} style={{
                padding: "5px 14px", borderRadius: 8, fontSize: 13, fontWeight: active ? 600 : 400,
                textDecoration: "none",
                background: active ? "var(--accent-dim)" : "transparent",
                border: active ? "1px solid var(--accent-glow)" : "1px solid transparent",
                color: active ? "var(--accent)" : "var(--text-secondary)",
              }}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* 실시간 매매 알림 토스트 */}
      {wsNotif && (
        <div style={{
          position: "fixed", top: 72, right: 24, zIndex: 200,
          background: wsNotif.action === "buy" ? "var(--green-dim)" : "var(--red-dim)",
          border: `1px solid ${wsNotif.action === "buy" ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.5)"}`,
          borderRadius: 12, padding: "14px 18px", minWidth: 260,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "fadeInDown 0.3s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 4,
              background: wsNotif.action === "buy" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
              color: wsNotif.action === "buy" ? "var(--green)" : "var(--red)",
            }}>
              {wsNotif.action === "buy" ? "매수 체결" : "매도 체결"}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{wsNotif.ticker}</span>
            <span style={{ fontSize: 10, marginLeft: "auto", color: "var(--text-muted)" }}>{wsNotif.market}</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
            {wsNotif.market === "US" ? "$" : "₩"}{wsNotif.price.toLocaleString()} × {wsNotif.quantity}주
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-muted)" }}>{wsNotif.reason}</p>
        </div>
      )}

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.02em" }}>자동매매 대시보드</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            KIS 한국투자증권 · MA5/MA20 골든크로스 신호 · 종목당 최대 20만원 · 손절 -8%
          </p>
        </div>

        {/* 상태 카드 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {statCards.map(({ label, value, color, dot }) => (
            <div key={label} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "18px 20px",
            }}>
              <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 500, margin: "0 0 10px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {label}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {dot && (
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: color,
                    boxShadow: systemOn ? `0 0 6px ${color}` : "none",
                  }} />
                )}
                <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0 }}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 리스크 설정 바 */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "12px 20px",
          display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
        }}>
          <span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>리스크 설정</span>
          {[
            { label: "종목당 최대", value: "50만원", color: "var(--gold)" },
            { label: "손절", value: "-5%", color: "var(--red)" },
            { label: "익절", value: "+10% / 트레일링", color: "var(--green)" },
            { label: "최대보유", value: "5종목", color: "var(--accent)" },
            { label: "신호", value: "MA+RSI+MACD+거래량", color: "var(--text-secondary)" },
          ].map(({ label, value, color }) => (
            <span key={label} style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {label} <strong style={{ color }}>{value}</strong>
            </span>
          ))}
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5,
              border: `1px solid ${wsConnected ? "rgba(99,102,241,0.4)" : "var(--border)"}`,
              color: wsConnected ? "#818cf8" : "var(--text-muted)",
              background: wsConnected ? "rgba(99,102,241,0.1)" : "transparent",
            }}>
              {wsConnected ? "● 실시간" : "○ 연결 중"}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px",
              borderRadius: 6, border: `1px solid ${systemOn ? "rgba(16,185,129,0.4)" : "var(--border)"}`,
              color: systemOn ? "var(--green)" : "var(--text-muted)",
              background: systemOn ? "var(--green-dim)" : "transparent",
            }}>
              {systemOn ? "ON" : "OFF"}
            </span>
          </span>
        </div>

        {/* 계좌 현황 */}
        {account && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>계좌 현황</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>KIS 한국투자증권</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0 }}>
              {[
                { label: "주문가능 예수금",  value: `${Math.round(account.cash / 10000).toLocaleString()}만원`,          color: "var(--accent)" },
                { label: "총 평가금액",      value: `${Math.round(account.total_eval / 10000).toLocaleString()}만원`,     color: "var(--text-primary)" },
                { label: "매입금액",         value: `${Math.round(account.buy_total / 10000).toLocaleString()}만원`,      color: "var(--text-secondary)" },
                { label: "평가손익",         value: `${account.pnl_amount >= 0 ? "+" : ""}${Math.round(account.pnl_amount / 10000).toLocaleString()}만원`, color: account.pnl_amount >= 0 ? "var(--green)" : "var(--red)" },
                { label: "수익률",           value: `${account.pnl_pct >= 0 ? "+" : ""}${account.pnl_pct.toFixed(2)}%`,  color: account.pnl_pct >= 0 ? "var(--green)" : "var(--red)" },
              ].map(({ label, value, color }, i) => (
                <div key={label} style={{
                  padding: "14px 18px",
                  borderRight: i < 4 ? "1px solid var(--border)" : "none",
                }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 500, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</p>
                  <p style={{ color, fontSize: 16, fontWeight: 700, margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>
            <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 24 }}>
              {[
                { label: "금일 매수", value: `${Math.round(account.today_buy / 10000).toLocaleString()}만원` },
                { label: "금일 매도", value: `${Math.round(account.today_sell / 10000).toLocaleString()}만원` },
                { label: "순자산",    value: `${Math.round(account.net_asset / 10000).toLocaleString()}만원` },
              ].map(({ label, value }) => (
                <span key={label} style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {label} <strong style={{ color: "var(--text-secondary)" }}>{value}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 워치리스트 관리 */}
        <WatchlistManager apiUrl={API ?? ""} />

        {/* 탭 */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
          {(["signals", "backtest"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: "8px 18px", fontSize: 13, fontWeight: activeTab === t ? 700 : 400,
              background: "transparent", border: "none", cursor: "pointer",
              color: activeTab === t ? "var(--accent)" : "var(--text-muted)",
              borderBottom: activeTab === t ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
            }}>
              {t === "signals" ? "유니버스 스캔" : "백테스트"}
            </button>
          ))}
        </div>

        {/* 백테스트 패널 */}
        {activeTab === "backtest" && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
            <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 16px" }}>
              6개월 백테스트 — 샤프지수 ≥ 1.0 · MDD ≥ -15% 충족 시 실전 적용
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <input
                value={btTicker}
                onChange={e => setBtTicker(e.target.value)}
                placeholder="티커 (예: 005930, AAPL)"
                style={{ flex: 1, minWidth: 160, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--text-primary)", outline: "none" }}
              />
              <select value={btMarket} onChange={e => setBtMarket(e.target.value)}
                style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}>
                <option value="KR">🇰🇷 KR</option>
                <option value="US">🇺🇸 US</option>
              </select>
              <button onClick={runBacktest} disabled={btLoading || !btTicker.trim()} style={{
                padding: "9px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700,
                background: btLoading || !btTicker.trim() ? "var(--card-hover)" : "var(--accent)",
                color: btLoading || !btTicker.trim() ? "var(--text-muted)" : "#fff", cursor: btLoading ? "not-allowed" : "pointer",
              }}>
                {btLoading ? "분석 중..." : "백테스트 실행"}
              </button>
            </div>

            {btResult && !btResult.error && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                  {[
                    { label: "총수익률", value: `${btResult.total_return > 0 ? "+" : ""}${btResult.total_return}%`, color: btResult.total_return >= 0 ? "var(--green)" : "var(--red)" },
                    { label: "샤프지수", value: btResult.sharpe?.toFixed(2) ?? "-", color: (btResult.sharpe ?? 0) >= 1.0 ? "var(--green)" : "var(--gold)" },
                    { label: "최대낙폭", value: `${btResult.mdd}%`, color: btResult.mdd >= -15 ? "var(--green)" : "var(--red)" },
                    { label: "승률", value: `${btResult.win_rate}%`, color: btResult.win_rate >= 50 ? "var(--green)" : "var(--text-secondary)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: "var(--bg-2)", borderRadius: 10, padding: "14px 16px", border: "1px solid var(--border)" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "0 0 6px" }}>{label}</p>
                      <p style={{ color, fontSize: 20, fontWeight: 800, margin: 0 }}>{value}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                  {[
                    { label: "총 거래", value: `${btResult.trade_count}건` },
                    { label: "평균 보유", value: `${btResult.avg_hold_days}일` },
                  ].map(({ label, value }) => (
                    <span key={label} style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}: <strong style={{ color: "var(--text-primary)" }}>{value}</strong></span>
                  ))}
                </div>
                <div style={{
                  padding: "10px 16px", borderRadius: 8,
                  background: btResult.ready_for_live ? "var(--green-dim)" : "rgba(234,179,8,0.1)",
                  border: `1px solid ${btResult.ready_for_live ? "rgba(16,185,129,0.3)" : "rgba(234,179,8,0.3)"}`,
                  color: btResult.ready_for_live ? "var(--green)" : "var(--gold)",
                  fontSize: 13, fontWeight: 700,
                }}>
                  {btResult.verdict}
                </div>
              </div>
            )}
            {btResult?.error && (
              <p style={{ color: "var(--red)", fontSize: 13 }}>{btResult.error}</p>
            )}
          </div>
        )}

        {/* 유니버스 시그널 테이블 */}
        {activeTab === "signals" && <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{
            padding: "14px 20px", borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <span style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }}>유니버스 스캔</span>
              <span style={{ color: "var(--text-muted)", fontSize: 12, marginLeft: 10 }}>
                KOSPI + NASDAQ/NYSE · 리서치 저널 포함 {signals.length}종목
              </span>
            </div>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>MA5 / MA20 · PER 필터</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {[
                    { label: "종목", align: "left" },
                    { label: "시장", align: "center" },
                    { label: "현재가", align: "right" },
                    { label: "MA5", align: "right" },
                    { label: "MA20", align: "right" },
                    { label: "PER", align: "right" },
                    { label: "시그널 / 저널노트", align: "left" },
                  ].map(({ label, align }) => (
                    <th key={label} style={{
                      padding: "11px 20px", color: "var(--text-muted)", fontSize: 11,
                      fontWeight: 500, textAlign: align as "left" | "right" | "center",
                      letterSpacing: "0.03em",
                    }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {signals.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                      KIS API 연결 확인 필요
                    </td>
                  </tr>
                )}
                {signals.map((s) => {
                  const isUS = s.market === "US";
                  const priceStr = s.current_price
                    ? isUS ? `$${s.current_price.toFixed(2)}` : `${Math.round(s.current_price).toLocaleString()}원`
                    : "-";
                  const maFmt = (v?: number) => v == null ? "-" : isUS ? v.toFixed(2) : Math.round(v).toLocaleString();
                  return (
                    <tr key={s.ticker} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--card-hover)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "13px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <p style={{ color: "var(--text-primary)", fontWeight: 600, margin: 0 }}>{s.name}</p>
                          {s.source === "journal" && (
                            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-glow)", fontWeight: 700 }}>
                              내종목
                            </span>
                          )}
                        </div>
                        <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "2px 0 0" }}>{s.ticker}</p>
                      </td>
                      <td style={{ padding: "13px 20px", textAlign: "center" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                          background: isUS ? "rgba(99,102,241,0.15)" : "rgba(16,185,129,0.1)",
                          color: isUS ? "#818cf8" : "var(--green)",
                          border: `1px solid ${isUS ? "rgba(99,102,241,0.3)" : "rgba(16,185,129,0.2)"}`,
                        }}>
                          {isUS ? "🇺🇸 US" : "🇰🇷 KR"}
                        </span>
                      </td>
                      <td style={{ padding: "13px 20px", textAlign: "right", color: "var(--text-primary)" }}>
                        {priceStr}
                      </td>
                      <td style={{ padding: "13px 20px", textAlign: "right", color: "var(--accent)" }}>
                        {maFmt(s.ma5)}
                      </td>
                      <td style={{ padding: "13px 20px", textAlign: "right", color: "var(--purple)" }}>
                        {maFmt(s.ma20)}
                      </td>
                      <td style={{ padding: "13px 20px", textAlign: "right", color: "var(--gold)" }}>
                        {s.per?.toFixed(1) ?? "-"}
                      </td>
                      <td style={{ padding: "13px 20px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <SignalBadge signal={s.signal} size="sm" />
                            {/* RSI/MACD/MTF 미니 뱃지 */}
                            {s.rsi != null && (
                              <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700,
                                background: s.rsi >= 40 && s.rsi <= 60 ? "var(--green-dim)" : "var(--red-dim)",
                                color: s.rsi >= 40 && s.rsi <= 60 ? "var(--green)" : "var(--red)" }}>
                                RSI {s.rsi}
                              </span>
                            )}
                            {s.macd_ok != null && (
                              <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700,
                                background: s.macd_ok ? "var(--green-dim)" : "var(--red-dim)",
                                color: s.macd_ok ? "var(--green)" : "var(--red)" }}>
                                MACD {s.macd_ok ? "↑" : "↓"}
                              </span>
                            )}
                            {s.mtf_ok != null && (
                              <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700,
                                background: s.mtf_ok ? "var(--green-dim)" : "var(--red-dim)",
                                color: s.mtf_ok ? "var(--green)" : "var(--red)" }}>
                                MTF {s.mtf_ok ? "✓" : "✗"}
                              </span>
                            )}
                            {s.reason && (
                              <span style={{ color: "var(--text-muted)", fontSize: 10, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {s.reason}
                              </span>
                            )}
                          </div>
                          {s.note && (
                            <p style={{ color: "var(--text-muted)", fontSize: 10, margin: 0, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: "italic" }}>
                              📝 {s.note}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>}

        {/* 보유 종목 */}
        {(status?.holdings?.length ?? 0) > 0 && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }}>보유 종목</span>
            </div>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["종목", "수량", "평균단가", "현재가", "수익률"].map((h, i) => (
                    <th key={h} style={{
                      padding: "10px 20px", color: "var(--text-muted)", fontSize: 11, fontWeight: 500,
                      textAlign: i === 0 ? "left" : "right",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {status!.holdings.map(h => {
                  const hColor = h.pnl_pct >= 0 ? "var(--green)" : "var(--red)";
                  return (
                    <tr key={h.ticker} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 20px" }}>
                        <p style={{ color: "var(--text-primary)", fontWeight: 600, margin: 0 }}>{h.name || h.ticker}</p>
                        <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "2px 0 0" }}>{h.ticker}</p>
                      </td>
                      <td style={{ padding: "12px 20px", textAlign: "right", color: "var(--text-primary)" }}>{h.quantity}주</td>
                      <td style={{ padding: "12px 20px", textAlign: "right", color: "var(--text-secondary)" }}>{h.avg_price.toLocaleString()}원</td>
                      <td style={{ padding: "12px 20px", textAlign: "right", color: "var(--text-primary)" }}>{h.current_price.toLocaleString()}원</td>
                      <td style={{ padding: "12px 20px", textAlign: "right", color: hColor, fontWeight: 700 }}>
                        {h.pnl_pct > 0 ? "+" : ""}{h.pnl_pct.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 체결 이력 */}
        <div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 14px" }}>
            체결 이력
          </p>
          {trades.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>체결 내역이 없습니다.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0, borderLeft: "2px solid var(--border)", paddingLeft: 20 }}>
              {trades.map((t) => {
                const isExpanded = expandedId === t.id;
                const isUS = t.market === "US";
                const priceStr = isUS ? `$${t.price.toLocaleString()}` : `${t.price.toLocaleString()}원`;
                return (
                  <div key={t.id} style={{ paddingBottom: 18, paddingTop: 2 }}>
                    <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "0 0 6px" }}>
                      {new Date(t.executed_at).toLocaleString("ko-KR")}
                    </p>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", cursor: t.details ? "pointer" : "default" }}
                      onClick={() => t.details && setExpandedId(isExpanded ? null : t.id)}
                    >
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 700,
                        background: t.action === "buy" ? "var(--green-dim)" : "var(--red-dim)",
                        color: t.action === "buy" ? "var(--green)" : "var(--red)",
                        border: `1px solid ${t.action === "buy" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                      }}>
                        {t.action === "buy" ? "매수" : "매도"}
                      </span>
                      <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{t.ticker}</span>
                      {t.market && (
                        <span style={{ fontSize: 10, color: isUS ? "#818cf8" : "var(--green)" }}>
                          {isUS ? "🇺🇸" : "🇰🇷"}
                        </span>
                      )}
                      <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                        {priceStr} × {t.quantity}주
                      </span>
                      <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: "auto" }}>
                        {REASON_LABEL[t.reason] || t.reason}
                      </span>
                      {t.details && (
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{isExpanded ? "▲" : "▼"}</span>
                      )}
                    </div>

                    {/* 상세 분석 패널 */}
                    {isExpanded && t.details && (
                      <div style={{
                        marginTop: 10, padding: "12px 14px",
                        background: "var(--bg-2)", borderRadius: 8,
                        border: "1px solid var(--border)", fontSize: 11,
                        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "6px 16px",
                      }}>
                        {[
                          { label: "MA5",     value: t.details.ma5?.toFixed(2) },
                          { label: "MA20",    value: t.details.ma20?.toFixed(2) },
                          { label: "RSI",     value: t.details.rsi?.toFixed(1) },
                          { label: "MACD",    value: t.details.macd_ok == null ? "-" : t.details.macd_ok ? "상승 ↑" : "하락 ↓", color: t.details.macd_ok ? "var(--green)" : t.details.macd_ok === false ? "var(--red)" : undefined },
                          { label: "거래량",  value: t.details.vol_ok == null ? "-" : t.details.vol_ok ? "충족" : "부족",       color: t.details.vol_ok  ? "var(--green)" : t.details.vol_ok  === false ? "var(--red)" : undefined },
                          { label: "MTF",     value: t.details.mtf_ok == null ? "-" : t.details.mtf_ok ? "정배열" : "역배열",   color: t.details.mtf_ok  ? "var(--green)" : t.details.mtf_ok  === false ? "var(--red)" : undefined },
                          { label: "PER",     value: t.details.per?.toFixed(1) },
                          { label: "PBR",     value: t.details.pbr?.toFixed(2) },
                          { label: "포지션배율", value: t.details.pos_mult != null ? `×${t.details.pos_mult}` : "-" },
                          { label: "재무필터", value: t.details.financial_filter_passed == null ? "-" : t.details.financial_filter_passed ? "통과" : `탈락: ${t.details.financial_filter_reason}`, color: t.details.financial_filter_passed ? "var(--green)" : "var(--red)" },
                          { label: "뉴스감성", value: t.details.news_sentiment != null ? `${t.details.news_sentiment.toFixed(2)} (${t.details.news_category || "-"})` : "-" },
                          { label: "투자금액", value: t.details.amount_invested != null ? (isUS ? `$${t.details.amount_invested.toFixed(0)}` : `${Math.round(t.details.amount_invested).toLocaleString()}원`) : "-" },
                          { label: "수익률",  value: t.details.pnl_pct != null ? `${t.details.pnl_pct > 0 ? "+" : ""}${t.details.pnl_pct.toFixed(2)}%` : "-", color: t.details.pnl_pct != null ? (t.details.pnl_pct >= 0 ? "var(--green)" : "var(--red)") : undefined },
                        ].filter(item => item.value != null).map(({ label, value, color }) => (
                          <div key={label}>
                            <span style={{ color: "var(--text-muted)" }}>{label}: </span>
                            <span style={{ color: color || "var(--text-primary)", fontWeight: 600 }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

export default function AutoTradePage() {
  return (
    <PasswordGate>
      <AutoTradeContent />
    </PasswordGate>
  );
}

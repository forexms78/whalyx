"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SignalBadge from "./SignalBadge";

const SESSION_KEY = "quant_unlocked";
const PASSWORD = process.env.NEXT_PUBLIC_QUANT_PASSWORD ?? "whalyx2024";
const API = process.env.NEXT_PUBLIC_API_URL;

interface Stock {
  ticker: string;
  name: string;
  market: string;
  current_price?: number;
}

interface Signal {
  ticker: string;
  name: string;
  signal: string;
  current_price?: number;
  ma5?: number;
  ma20?: number;
  per?: number;
  reason?: string;
}

interface Trade {
  id: string;
  ticker: string;
  action: string;
  price: number;
  quantity: number;
  reason: string;
  executed_at: string;
}

interface Status {
  system_on: boolean;
  trades_today: number;
  total_invested: number;
  total_pnl_pct: number;
}

function PasswordForm({ onUnlock }: { onUnlock: () => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (input === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      onUnlock();
    } else {
      setError(true);
      setInput("");
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "80px 24px" }}>
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: "40px 32px", width: "100%", maxWidth: 360,
        display: "flex", flexDirection: "column", gap: 20,
      }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--accent)", fontWeight: 700, fontSize: 18, margin: 0 }}>Whalyx Quant</p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "6px 0 0" }}>비밀번호를 입력하세요</p>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            placeholder="비밀번호"
            autoFocus
            style={{
              background: "var(--bg-2)", border: `1px solid ${error ? "#ef4444" : "var(--border)"}`,
              borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)",
              fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
            }}
          />
          {error && <p style={{ color: "#ef4444", fontSize: 12, textAlign: "center", margin: 0 }}>비밀번호가 틀렸습니다</p>}
          <button type="submit" style={{
            background: "var(--accent)", color: "#fff", border: "none",
            borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>
            입장
          </button>
        </form>
      </div>
    </div>
  );
}

function QuantDashboard() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/quant/stocks`).then(r => r.json()).catch(() => []),
      fetch(`${API}/autotrade/signals`).then(r => r.json()).catch(() => []),
      fetch(`${API}/autotrade/trades`).then(r => r.json()).catch(() => []),
      fetch(`${API}/autotrade/status`).then(r => r.json()).catch(() => null),
    ]).then(([s, sig, t, st]) => {
      setStocks(Array.isArray(s) ? s : []);
      setSignals(Array.isArray(sig) ? sig : []);
      setTrades(Array.isArray(t) ? t.slice(0, 5) : []);
      setStatus(st);
      setLoading(false);
    });
  }, []);

  const buySignals = signals.filter(s => s.signal === "buy");
  const sellSignals = signals.filter(s => s.signal === "sell");
  const systemOn = status?.system_on ?? false;
  const pnlColor = (status?.total_pnl_pct ?? 0) >= 0 ? "#22c55e" : "#ef4444";

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>

      {/* 상태 배너 — 시스템 온/오프 + 수익률 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        background: "var(--card)", border: `1px solid ${systemOn ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
        borderRadius: 12, padding: "14px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: systemOn ? "#22c55e" : "#6b7280",
            boxShadow: systemOn ? "0 0 6px #22c55e" : "none",
            display: "inline-block",
          }} />
          <span style={{ color: systemOn ? "#22c55e" : "var(--text-muted)", fontWeight: 700, fontSize: 13 }}>
            자동매매 {systemOn ? "실행 중" : "오프라인"}
          </span>
        </div>
        <span style={{ color: "var(--border)", fontSize: 16 }}>|</span>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
          오늘 체결 <strong style={{ color: "var(--text-primary)" }}>{status?.trades_today ?? 0}건</strong>
        </span>
        <span style={{ color: "var(--border)", fontSize: 16 }}>|</span>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
          투자 중{" "}
          <strong style={{ color: "#60a5fa" }}>
            {status?.total_invested ? `${Math.round(status.total_invested / 10000)}만원` : "-"}
          </strong>
        </span>
        <span style={{ color: "var(--border)", fontSize: 16 }}>|</span>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
          수익률{" "}
          <strong style={{ color: pnlColor }}>
            {status?.total_pnl_pct != null
              ? `${status.total_pnl_pct > 0 ? "+" : ""}${status.total_pnl_pct}%`
              : "-"}
          </strong>
        </span>
        <Link href="/autotrade" style={{
          marginLeft: "auto", color: "var(--accent)", fontSize: 12,
          textDecoration: "none", flexShrink: 0,
        }}>
          자동매매 전체 →
        </Link>
      </div>

      {/* 요약 카드 3개 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[
          { label: "리서치 종목", value: loading ? "..." : `${stocks.length}개`, sub: "저널 추적 중", color: "#60a5fa" },
          { label: "매수 시그널", value: loading ? "..." : `${buySignals.length}개`, sub: "골든크로스 감지", color: "#22c55e" },
          { label: "매도 시그널", value: loading ? "..." : `${sellSignals.length}개`, sub: "데드크로스 감지", color: "#ef4444" },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 12, padding: "20px 24px",
          }}>
            <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "0 0 8px", fontWeight: 500 }}>{label}</p>
            <p style={{ color, fontSize: 28, fontWeight: 800, margin: "0 0 4px" }}>{value}</p>
            <p style={{ color: "var(--text-muted)", fontSize: 11, margin: 0 }}>{sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* 자동매매 유니버스 시그널 */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{
            padding: "16px 20px", borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <p style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 600, margin: 0 }}>자동매매 유니버스</p>
              <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "2px 0 0" }}>MA5/MA20 골든크로스 · PER 필터</p>
            </div>
            <Link href="/autotrade" style={{ color: "var(--accent)", fontSize: 12, textDecoration: "none" }}>
              전체 보기 →
            </Link>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["종목", "현재가", "MA5", "MA20", "시그널"].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px", color: "var(--text-muted)", fontSize: 11, fontWeight: 500,
                      textAlign: h === "종목" ? "left" : "center",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>불러오는 중...</td></tr>
                ) : signals.slice(0, 8).map(s => (
                  <tr key={s.ticker} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <p style={{ color: "var(--text-primary)", fontWeight: 600, margin: 0, fontSize: 13 }}>{s.name}</p>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "2px 0 0" }}>{s.ticker}</p>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--text-primary)", fontSize: 13 }}>
                      {s.current_price ? `${s.current_price.toLocaleString()}원` : "-"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", color: "#60a5fa", fontSize: 13 }}>
                      {s.ma5 ? s.ma5.toLocaleString() : "-"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", color: "#a78bfa", fontSize: 13 }}>
                      {s.ma20 ? s.ma20.toLocaleString() : "-"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <SignalBadge signal={s.signal} size="sm" />
                    </td>
                  </tr>
                ))}
                {!loading && signals.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>시그널 없음</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 오른쪽 컬럼 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* 리서치 저널 — 종목별 기록 접근 */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <p style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 600, margin: 0 }}>리서치 저널</p>
                <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "2px 0 0" }}>종목 클릭 → AI 분석 텍스트 붙여넣기</p>
              </div>
              <Link href="/quant" style={{ color: "var(--accent)", fontSize: 12, textDecoration: "none" }}>
                전체 보기 →
              </Link>
            </div>
            <div style={{ padding: "8px 0" }}>
              {loading ? (
                <p style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13, margin: 0 }}>불러오는 중...</p>
              ) : stocks.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 12px" }}>추적 중인 종목 없음</p>
                  <Link href="/quant" style={{
                    color: "var(--accent)", fontSize: 12, textDecoration: "none",
                    border: "1px solid var(--accent-glow)", borderRadius: 6, padding: "6px 14px",
                  }}>
                    종목 추가하기 →
                  </Link>
                </div>
              ) : stocks.slice(0, 5).map(s => (
                <Link key={s.ticker} href={`/quant/stocks/${s.ticker}`} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 20px", textDecoration: "none", borderBottom: "1px solid var(--border)",
                }}>
                  <div>
                    <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, margin: 0 }}>{s.name}</p>
                    <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "2px 0 0" }}>{s.ticker} · {s.market}</p>
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>분석 기록 →</span>
                </Link>
              ))}
            </div>
          </div>

          {/* 최근 체결 이력 */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <p style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 600, margin: 0 }}>최근 체결</p>
            </div>
            <div style={{ padding: "8px 0" }}>
              {loading ? (
                <p style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13, margin: 0 }}>불러오는 중...</p>
              ) : trades.length === 0 ? (
                <p style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13, margin: 0 }}>체결 내역 없음</p>
              ) : trades.map(t => (
                <div key={t.id} style={{
                  padding: "10px 20px", borderBottom: "1px solid var(--border)",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 700,
                      background: t.action === "buy" ? "#22c55e" : "#ef4444", color: "#fff",
                    }}>
                      {t.action === "buy" ? "매수" : "매도"}
                    </span>
                    <div>
                      <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, margin: 0 }}>{t.ticker}</p>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "1px 0 0" }}>
                        {t.price.toLocaleString()}원 × {t.quantity}주
                      </p>
                    </div>
                  </div>
                  <p style={{ color: "var(--text-muted)", fontSize: 11, margin: 0, flexShrink: 0 }}>
                    {new Date(t.executed_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function QuantTab() {
  const [unlocked, setUnlocked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem(SESSION_KEY) === "1") setUnlocked(true);
  }, []);

  if (!mounted) return null;
  if (!unlocked) return <PasswordForm onUnlock={() => setUnlocked(true)} />;
  return <QuantDashboard />;
}

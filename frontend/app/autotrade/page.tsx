"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SignalBadge from "@/components/quant/SignalBadge";

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

interface Trade {
  id: string;
  ticker: string;
  action: string;
  price: number;
  quantity: number;
  amount: number;
  reason: string;
  executed_at: string;
}

interface Signal {
  ticker: string;
  name: string;
  forward_pe?: number;
  avg_fair_value?: number;
  current_price?: number;
  signal: string;
}

const API = process.env.NEXT_PUBLIC_API_URL;

const REASON_LABEL: Record<string, string> = {
  signal_buy: "시그널 매수",
  stop_loss: "손절",
  take_profit: "익절",
};

export default function AutoTradePage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/autotrade/status`).then((r) => r.json()),
      fetch(`${API}/autotrade/trades`).then((r) => r.json()),
      fetch(`${API}/autotrade/signals`).then((r) => r.json()),
    ]).then(([s, t, sig]) => {
      setStatus(s);
      setTrades(Array.isArray(t) ? t : []);
      setSignals(Array.isArray(sig) ? sig : []);
      setLoading(false);
    });
  }, []);

  const pnlColor = (status?.total_pnl_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <span className="text-blue-400 font-bold text-lg">Whalyx Quant</span>
        <div className="flex gap-6">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">리서치 저널</Link>
          <span className="text-white text-sm border-b border-green-400 pb-1">자동매매</span>
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-400 text-sm border-l border-gray-800 pl-6">레거시</Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">자동매매 대시보드</h1>
          <p className="text-gray-500 text-sm">
            KIS 한국투자증권 · 종목당 최대 50만원 · 손절 -8% 자동 매도
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: "시스템",
              value: loading ? "..." : status?.system_on ? "실행중" : "오프라인",
              color: status?.system_on ? "text-green-400" : "text-red-400",
            },
            { label: "오늘 체결", value: `${status?.trades_today ?? 0}건`, color: "text-white" },
            {
              label: "투자중 금액",
              value: status?.total_invested ? `${Math.round(status.total_invested / 10000)}만원` : "-",
              color: "text-blue-400",
            },
            {
              label: "오늘 수익",
              value: status?.total_pnl_pct != null
                ? `${status.total_pnl_pct > 0 ? "+" : ""}${status.total_pnl_pct}%`
                : "-",
              color: pnlColor,
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-900 rounded-xl p-4 text-center">
              <p className="text-gray-500 text-xs mb-1">{label}</p>
              <p className={`font-bold text-base ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 rounded-xl p-3 flex gap-6 text-sm">
          <span className="text-gray-400">리스크 설정</span>
          <span className="text-gray-200">종목당 최대 <strong className="text-yellow-400">50만원</strong></span>
          <span className="text-gray-200">손절선 <strong className="text-red-400">-8%</strong> 자동 매도</span>
          <span className={`ml-auto font-bold px-3 py-0.5 rounded text-xs border ${
            status?.system_on
              ? "border-green-500 text-green-400 bg-green-500/10"
              : "border-gray-600 text-gray-400"
          }`}>
            {status?.system_on ? "ON" : "OFF"}
          </span>
        </div>

        <div className="bg-gray-900 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 text-sm text-gray-400">
            시그널 감지 종목 (KR)
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-600 text-xs border-b border-gray-800">
                <th className="text-left px-4 py-2">종목</th>
                <th className="px-4 py-2">Forward P/E</th>
                <th className="px-4 py-2">적정가</th>
                <th className="px-4 py-2">현재가</th>
                <th className="px-4 py-2">시그널</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.ticker} className="border-b border-gray-800 hover:bg-gray-800">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{s.name || s.ticker}</p>
                    <p className="text-gray-500 text-xs">{s.ticker}</p>
                  </td>
                  <td className="px-4 py-3 text-center text-yellow-400">
                    {s.forward_pe?.toFixed(1) ?? "N/A"}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">
                    {s.avg_fair_value ? `${s.avg_fair_value.toLocaleString()}원` : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-center text-white">
                    {s.current_price ? `${s.current_price.toLocaleString()}원` : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <SignalBadge signal={s.signal} size="sm" />
                  </td>
                </tr>
              ))}
              {signals.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-600">
                    추적 중인 KR 종목이 없습니다. 리서치 저널에서 KR 종목을 추가하세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-sm text-gray-400 mb-4">체결 이력</h2>
          {trades.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">체결 내역이 없습니다.</p>
          ) : (
            <div className="border-l-2 border-gray-800 pl-4 space-y-4">
              {trades.map((t) => (
                <div key={t.id}>
                  <p className="text-gray-500 text-xs">
                    {new Date(t.executed_at).toLocaleString("ko-KR")}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                      t.action === "buy" ? "bg-green-500 text-black" : "bg-red-500 text-black"
                    }`}>
                      {t.action === "buy" ? "매수" : "매도"}
                    </span>
                    <span className="text-sm text-gray-200">{t.ticker}</span>
                    <span className="text-sm text-gray-400">
                      {t.price.toLocaleString()}원 × {t.quantity}주
                    </span>
                    <span className="text-xs text-gray-600 ml-auto">
                      {REASON_LABEL[t.reason] || t.reason}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

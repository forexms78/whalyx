"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QuantTooltip from "@/components/quant/QuantTooltip";
import SignalBadge from "@/components/quant/SignalBadge";
import FairValuePanel from "@/components/quant/FairValuePanel";
import PasteAnalyzer from "@/components/quant/PasteAnalyzer";
import JournalTimeline from "@/components/quant/JournalTimeline";

interface Stock {
  id: string;
  ticker: string;
  market: string;
  name: string;
  current_price?: number;
  forward_eps?: number;
  bps?: number;
  eps_growth_rate?: number;
  target_pe?: number;
  overhang_note?: string;
}

interface JournalEntry {
  id: string;
  date: string;
  action: string;
  price?: number;
  quantity?: number;
  analysis_text?: string;
  signal?: string;
  forward_pe?: number;
  fair_value_pe?: number;
  fair_value_graham?: number;
  fair_value_peg?: number;
  created_at: string;
}

interface Metrics {
  forward_pe?: number;
  fair_value_pe?: number;
  fair_value_graham?: number;
  fair_value_peg?: number;
  avg_fair_value?: number;
  signal?: string;
}

const API = process.env.NEXT_PUBLIC_API_URL;

export default function StockDetailPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const [stock, setStock] = useState<Stock | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [lastMetrics, setLastMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    const [s, j] = await Promise.all([
      fetch(`${API}/quant/stocks/${ticker}`).then((r) => r.json()),
      fetch(`${API}/quant/journal/${ticker}`).then((r) => r.json()),
    ]);
    setStock(s?.ticker ? s : null);
    setEntries(Array.isArray(j) ? j : []);
    if (Array.isArray(j) && j.length > 0) setLastMetrics(j[0]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [ticker]);

  function handleAnalyzed(result: Metrics & { current_price?: number }) {
    setLastMetrics(result);
    fetchData();
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
      로딩 중...
    </div>
  );

  if (!stock) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
      종목을 찾을 수 없습니다.
    </div>
  );

  const signal = lastMetrics?.signal;
  const cp = stock.current_price;

  const signalBannerClass = signal === "buy"
    ? "bg-green-500/10 border-green-500"
    : signal === "sell"
    ? "bg-red-500/10 border-red-500"
    : "bg-yellow-500/10 border-yellow-500";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center gap-6">
        <Link href="/" className="text-blue-400 font-bold text-lg">Whalyx Quant</Link>
        <Link href="/" className="text-gray-400 hover:text-white text-sm">리서치 저널</Link>
        <Link href="/autotrade" className="text-gray-400 hover:text-white text-sm">자동매매</Link>
        <Link href="/dashboard" className="text-gray-600 hover:text-gray-400 text-sm border-l border-gray-800 pl-6">레거시</Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div>
          <p className="text-gray-500 text-sm">{stock.ticker} · {stock.market}</p>
          <h1 className="text-2xl font-bold mt-1">{stock.name}</h1>
        </div>

        {signal && (
          <div className={`flex items-center justify-between rounded-xl border p-4 ${signalBannerClass}`}>
            <SignalBadge signal={signal} />
            {lastMetrics?.forward_pe && (
              <QuantTooltip term="Forward P/E">
                <span className="text-sm text-gray-400">Forward P/E {lastMetrics.forward_pe}</span>
              </QuantTooltip>
            )}
          </div>
        )}

        {cp && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "현재가", value: `$${cp.toLocaleString()}`, tooltip: null, color: "text-white" },
              { label: "Forward P/E", value: lastMetrics?.forward_pe ?? "N/A", tooltip: "Forward P/E", color: "text-yellow-400" },
              { label: "EPS(FWD)", value: stock.forward_eps ? `$${stock.forward_eps}` : "N/A", tooltip: "EPS", color: "text-green-400" },
              { label: "오버행", value: stock.overhang_note ? "있음" : "없음", tooltip: "오버행", color: stock.overhang_note ? "text-red-400" : "text-gray-400" },
            ].map(({ label, value, tooltip, color }) => (
              <div key={label} className="bg-gray-900 rounded-xl p-3 text-center">
                <p className="text-gray-500 text-xs mb-1">
                  {tooltip ? (
                    <QuantTooltip term={tooltip}>{label}</QuantTooltip>
                  ) : label}
                </p>
                <p className={`font-bold text-base ${color}`}>{String(value)}</p>
              </div>
            ))}
          </div>
        )}

        {cp && lastMetrics && (
          <FairValuePanel
            currentPrice={cp}
            fairValuePe={lastMetrics.fair_value_pe ?? null}
            fairValueGraham={lastMetrics.fair_value_graham ?? null}
            fairValuePeg={lastMetrics.fair_value_peg ?? null}
            avgFairValue={lastMetrics.avg_fair_value ?? null}
          />
        )}

        <PasteAnalyzer
          ticker={ticker as string}
          targetPe={stock.target_pe ?? 30}
          onAnalyzed={handleAnalyzed}
        />

        <div>
          <h2 className="text-sm text-gray-400 mb-4">분석 이력</h2>
          <JournalTimeline entries={entries as any} />
        </div>
      </main>
    </div>
  );
}

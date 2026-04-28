"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import StockCard from "@/components/quant/StockCard";

interface Stock {
  id: string;
  ticker: string;
  market: string;
  name: string;
  current_price?: number;
  forward_eps?: number;
  target_pe?: number;
  added_at: string;
}

interface AddForm {
  ticker: string;
  market: string;
  name: string;
}

const API = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [form, setForm] = useState<AddForm>({ ticker: "", market: "US", name: "" });
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchStocks() {
    const data = await fetch(`${API}/quant/stocks`).then((r) => r.json());
    setStocks(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { fetchStocks(); }, []);

  async function addStock() {
    if (!form.ticker) return;
    setAdding(true);
    await fetch(`${API}/quant/stocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, name: form.name || form.ticker }),
    });
    setForm({ ticker: "", market: "US", name: "" });
    await fetchStocks();
    setAdding(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <span className="text-blue-400 font-bold text-lg">Whalyx Quant</span>
        <div className="flex gap-6">
          <span className="text-white text-sm border-b border-blue-400 pb-1">리서치 저널</span>
          <Link href="/autotrade" className="text-gray-400 hover:text-white text-sm">자동매매</Link>
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-400 text-sm border-l border-gray-800 pl-6">레거시</Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">리서치 저널</h1>
          <p className="text-gray-500 text-sm">분석한 종목을 추가하고 퀀트 일지를 기록하세요.</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 flex gap-3 flex-wrap items-center">
          <input
            className="bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 flex-1 min-w-[120px] focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="티커 (AAPL, 005930)"
            value={form.ticker}
            onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
            onKeyDown={(e) => e.key === "Enter" && addStock()}
          />
          <input
            className="bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 flex-1 min-w-[120px] focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="종목명"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="bg-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            value={form.market}
            onChange={(e) => setForm({ ...form, market: e.target.value })}
          >
            <option value="US">US</option>
            <option value="KR">KR</option>
          </select>
          <button
            onClick={addStock}
            disabled={adding || !form.ticker}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-lg px-4 py-2 text-sm transition"
          >
            {adding ? "추가 중..." : "+ 종목 추가"}
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-900 rounded-xl p-4 h-24 animate-pulse" />
            ))}
          </div>
        ) : stocks.length === 0 ? (
          <p className="text-gray-600 text-center py-16">종목을 추가해 퀀트 리서치를 시작하세요.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stocks.map((s) => (
              <StockCard
                key={s.id}
                ticker={s.ticker}
                market={s.market}
                name={s.name}
                currentPrice={s.current_price}
                lastDate={new Date(s.added_at).toLocaleDateString("ko-KR")}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

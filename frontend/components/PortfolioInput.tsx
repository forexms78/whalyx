"use client";

import { useState } from "react";

const SAMPLE_PORTFOLIOS = ["삼성전자", "NVDA", "TSM", "AAPL", "LMT"];

interface Props {
  onAnalyze: (portfolio: string[]) => void;
}

export default function PortfolioInput({ onAnalyze }: Props) {
  const [input, setInput] = useState("");
  const [stocks, setStocks] = useState<string[]>([]);

  const addStock = () => {
    const trimmed = input.trim().toUpperCase();
    if (trimmed && !stocks.includes(trimmed)) {
      setStocks([...stocks, trimmed]);
    }
    setInput("");
  };

  const removeStock = (stock: string) => {
    setStocks(stocks.filter((s) => s !== stock));
  };

  const loadSample = () => {
    setStocks(SAMPLE_PORTFOLIOS);
  };

  return (
    <div className="max-w-2xl mx-auto mt-16">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold mb-3">포트폴리오 리스크 분석</h2>
        <p className="text-gray-400">보유 종목을 입력하면 16개 AI 에이전트가 지정학 리스크를 분석합니다</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addStock()}
            placeholder="종목 코드 입력 (예: NVDA, 삼성전자)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder-gray-500"
          />
          <button
            onClick={addStock}
            className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl text-sm font-medium transition-colors"
          >
            추가
          </button>
        </div>

        {stocks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {stocks.map((stock) => (
              <span
                key={stock}
                className="flex items-center gap-2 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-full text-sm"
              >
                {stock}
                <button onClick={() => removeStock(stock)} className="text-gray-500 hover:text-red-400 text-xs">
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button onClick={loadSample} className="text-xs text-gray-500 hover:text-gray-300 underline">
            샘플 포트폴리오 불러오기
          </button>
          <button
            onClick={() => onAnalyze(stocks)}
            disabled={stocks.length === 0}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed px-8 py-3 rounded-xl text-sm font-semibold transition-all"
          >
            분석 시작
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4 text-center">
        {[
          { label: "AI 에이전트", value: "16개" },
          { label: "분석 데이터", value: "뉴스 + 주가" },
          { label: "운영 비용", value: "$0 / 월" },
        ].map((item) => (
          <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xl font-bold text-blue-400">{item.value}</div>
            <div className="text-xs text-gray-500 mt-1">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

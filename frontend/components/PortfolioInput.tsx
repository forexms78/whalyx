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
    <div className="max-w-2xl mx-auto mt-12">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2" style={{ color: "#1C1E21" }}>
          포트폴리오 리스크 분석
        </h2>
        <p style={{ color: "#65676B" }}>
          보유 종목을 입력하면 16개 AI 에이전트가 지정학 리스크를 분석합니다
        </p>
      </div>

      <div
        className="rounded-xl p-6 space-y-4"
        style={{
          background: "#fff",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)",
        }}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addStock()}
            placeholder="종목 코드 입력 (예: NVDA, 삼성전자)"
            className="flex-1 rounded-lg px-4 py-3 text-sm focus:outline-none"
            style={{
              background: "#F0F2F5",
              border: "1px solid #CED0D4",
              color: "#1C1E21",
              fontSize: "15px",
            }}
          />
          <button
            onClick={addStock}
            className="px-5 py-3 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: "#1877F2" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#166FE5")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#1877F2")}
          >
            추가
          </button>
        </div>

        {stocks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {stocks.map((stock) => (
              <span
                key={stock}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                style={{
                  background: "#E7F3FF",
                  color: "#1877F2",
                  border: "1px solid #B0C8F7",
                }}
              >
                {stock}
                <button
                  onClick={() => removeStock(stock)}
                  className="text-xs"
                  style={{ color: "#1877F2", opacity: 0.7 }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={loadSample}
            className="text-sm underline"
            style={{ color: "#65676B" }}
          >
            샘플 포트폴리오 불러오기
          </button>
          <button
            onClick={() => onAnalyze(stocks)}
            disabled={stocks.length === 0}
            className="px-8 py-3 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#1877F2" }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled)
                e.currentTarget.style.background = "#166FE5";
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.disabled)
                e.currentTarget.style.background = "#1877F2";
            }}
          >
            분석 시작
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 text-center">
        {[
          { label: "AI 에이전트", value: "16개" },
          { label: "분석 데이터", value: "뉴스 + 주가" },
          { label: "운영 비용", value: "$0 / 월" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl p-4"
            style={{
              background: "#fff",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              border: "1px solid #E4E6EB",
            }}
          >
            <div className="text-xl font-bold" style={{ color: "#1877F2" }}>
              {item.value}
            </div>
            <div className="text-xs mt-1" style={{ color: "#65676B" }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

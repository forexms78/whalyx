"use client";

import { useState } from "react";
import PortfolioInput from "@/components/PortfolioInput";
import Dashboard from "@/components/Dashboard";
import { AnalysisResult } from "@/types";

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (portfolio: string[]) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_request: "내 포트폴리오의 지정학 리스크를 분석해줘",
          portfolio,
        }),
      });
      if (!res.ok) throw new Error("분석 요청 실패");
      const data = await res.json();
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <span className="text-2xl">⚔️</span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">War-Investment Agent</h1>
            <p className="text-xs text-gray-400">지정학 리스크 기반 포트폴리오 분석 시스템</p>
          </div>
          <span className="ml-auto text-xs bg-green-900/50 text-green-400 border border-green-800 px-3 py-1 rounded-full">
            16 AI Agents Active
          </span>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-8 py-10">
        {!result && !loading && <PortfolioInput onAnalyze={handleAnalyze} />}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-gray-700" />
              <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
            </div>
            <p className="text-gray-400 text-sm">OMS 팀 에이전트 분석 중...</p>
            <p className="text-xs text-gray-600">PM → TPM → Supervisor 1/2/3 → 최종 리포트</p>
          </div>
        )}
        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button onClick={() => setError(null)} className="mt-4 text-sm text-gray-400 hover:text-white underline">
              다시 시도
            </button>
          </div>
        )}
        {result && <Dashboard result={result} onReset={() => setResult(null)} />}
      </div>
    </main>
  );
}

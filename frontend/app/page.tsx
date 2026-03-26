"use client";

import { useEffect, useState } from "react";
import { InvestorSummary, HotStock, RecommendedStock, CoinData, RealEstateIndicator, MoneyFlowAsset, NewsItem, CommodityData, WhaleSignal, KoreaRates } from "@/types";
import InvestorCard from "@/components/InvestorCard";
import InvestorModal from "@/components/InvestorModal";
import StockModal from "@/components/StockModal";
import HotStocksBar from "@/components/HotStocksBar";
import RecommendSection from "@/components/RecommendSection";
import CryptoSection from "@/components/CryptoSection";
import RealEstateSection from "@/components/RealEstateSection";
import MoneyFlowSection from "@/components/MoneyFlowSection";
import CommoditySection from "@/components/CommoditySection";
import SkeletonCard from "@/components/SkeletonCard";
import WhaleSignalSection from "@/components/WhaleSignalSection";

const API = process.env.NEXT_PUBLIC_API_URL;

type Tab = "signal" | "stocks" | "crypto" | "realestate" | "commodities";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("signal");
  const [investors, setInvestors] = useState<InvestorSummary[]>([]);
  const [hotStocks, setHotStocks] = useState<HotStock[]>([]);
  const [recommendations, setRecommendations] = useState<{ buy: RecommendedStock[]; sell: RecommendedStock[] } | null>(null);
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [cryptoNews, setCryptoNews] = useState<NewsItem[]>([]);
  const [reData, setReData] = useState<{ indicators: RealEstateIndicator[]; news: NewsItem[] } | null>(null);
  const [commodityData, setCommodityData] = useState<{ commodities: CommodityData[]; news: NewsItem[] } | null>(null);
  const [moneyFlow, setMoneyFlow] = useState<{ assets: MoneyFlowAsset[]; rate_signal: { level: string; message: string }; fed_rate: number; korea_rates?: KoreaRates } | null>(null);
  const [whaleSignal, setWhaleSignal] = useState<WhaleSignal | null>(null);
  const [loadingInvestors, setLoadingInvestors] = useState(true);
  const [loadingTab, setLoadingTab] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("light");

  // 테마 토글
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  // 투자자 + 핫종목 + 추천 (초기 로드)
  useEffect(() => {
    Promise.all([
      fetch(`${API}/investors`).then(r => r.json()),
      fetch(`${API}/stocks/hot`).then(r => r.json()),
      fetch(`${API}/stocks/recommendations`).then(r => r.json()),
      fetch(`${API}/money-flow`).then(r => r.json()),
      fetch(`${API}/whale-signal`).then(r => r.json()),
    ]).then(([invData, stockData, recData, flowData, signalData]) => {
      setInvestors(invData.investors || []);
      setHotStocks(stockData.stocks || []);
      setRecommendations(recData);
      setMoneyFlow(flowData);
      if (signalData?.signals && Array.isArray(signalData.signals)) {
        setWhaleSignal(signalData);
      }
    }).finally(() => setLoadingInvestors(false));
  }, []);

  // 탭 전환 시 데이터 로드
  useEffect(() => {
    if (activeTab === "crypto" && coins.length === 0) {
      setLoadingTab(true);
      fetch(`${API}/crypto`).then(r => r.json()).then(data => {
        setCoins(data.coins || []);
        setCryptoNews(data.news || []);
      }).finally(() => setLoadingTab(false));
    }
    if (activeTab === "realestate" && !reData) {
      setLoadingTab(true);
      fetch(`${API}/realestate`).then(r => r.json()).then(data => {
        setReData(data);
      }).finally(() => setLoadingTab(false));
    }
    if (activeTab === "commodities" && !commodityData) {
      setLoadingTab(true);
      fetch(`${API}/commodities`).then(r => r.json()).then(data => {
        setCommodityData(data);
      }).finally(() => setLoadingTab(false));
    }
  }, [activeTab]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "signal", label: "Whale Signal" },
    { id: "stocks", label: "주식" },
    { id: "crypto", label: "코인" },
    { id: "realestate", label: "부동산" },
    { id: "commodities", label: "광물" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* 헤더 */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 100,
        background: "var(--header-bg)", backdropFilter: "blur(16px)",
      }}>
        <div className="header-inner" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* 로고 */}
          <div className="header-top-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* W 로고 마크 */}
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: "var(--accent)", display: "flex",
              alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>W</span>
            </div>
            <div>
              <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.03em" }}>Whalyx</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>Whale Tracker</span>
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <nav className="header-nav" style={{ display: "flex", gap: 4 }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className="tab-btn"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: activeTab === tab.id ? "var(--accent-dim)" : "transparent",
                  border: activeTab === tab.id ? "1px solid var(--accent-glow)" : "1px solid transparent",
                  borderRadius: 8, padding: "6px 14px",
                  color: activeTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
                  cursor: "pointer", fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* 우측: 테마 토글 + 설명 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="header-right" style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
              13F Filing · Live Markets · AI Insight
            </div>
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
              style={{
                background: "var(--toggle-bg, var(--card))",
                border: "1px solid var(--border)",
                borderRadius: 20,
                padding: "5px 12px",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-secondary)",
                transition: "all 0.15s",
                flexShrink: 0,
                letterSpacing: "0.04em",
              }}
            >
              {theme === "dark" ? "LIGHT" : "DARK"}
            </button>
          </div>
        </div>
      </header>

      {/* ── Upbit 스타일 퀵스탯 티커 바 ── */}
      {moneyFlow && (
        <div style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-2)",
        }}>
          <div style={{
            maxWidth: 1280, margin: "0 auto", padding: "0 24px",
            height: 38, display: "flex", alignItems: "center", gap: 0,
            overflowX: "auto", scrollbarWidth: "none",
          }}>
            {/* Fed 금리 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 18px", borderRight: "1px solid var(--border)", flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Fed Rate</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{moneyFlow.fed_rate}%</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>3.50–3.75 target</span>
            </div>
            {/* 자산별 30일 수익률 */}
            {moneyFlow.assets.slice(0, 4).map(asset => {
              const chg = asset.change_30d ?? 0;
              const isUp = chg >= 0;
              return (
                <div key={asset.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", borderRight: "1px solid var(--border)", flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{asset.name.split(" ")[0]}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: isUp ? "var(--green)" : "var(--red)" }}>
                    {isUp ? "+" : ""}{chg.toFixed(1)}%
                  </span>
                </div>
              );
            })}
            {/* 원달러 환율 */}
            {moneyFlow.korea_rates?.usd_krw && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>KRW/USD</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                  {moneyFlow.korea_rates.usd_krw.toLocaleString("ko-KR")}
                </span>
                {moneyFlow.korea_rates.usd_krw_change_1d != null && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: moneyFlow.korea_rates.usd_krw_change_1d >= 0 ? "var(--red)" : "var(--green)" }}>
                    {moneyFlow.korea_rates.usd_krw_change_1d >= 0 ? "+" : ""}{moneyFlow.korea_rates.usd_krw_change_1d.toFixed(2)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        {/* ── Whale Signal 탭 ── */}
        {activeTab === "signal" && (
          <div className="fade-in">
            {!whaleSignal ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} height={180} />)}
              </div>
            ) : (
              <WhaleSignalSection data={whaleSignal} onTabChange={setActiveTab} />
            )}
            {moneyFlow && <MoneyFlowSection data={moneyFlow} korea_rates={moneyFlow.korea_rates} />}
          </div>
        )}

        {/* ── 주식 탭 ── */}
        {activeTab === "stocks" && (
          <div className="fade-in">
            {/* 핫 종목 */}
            <HotStocksBar stocks={hotStocks} onSelect={setSelectedStock} usd_krw={moneyFlow?.korea_rates?.usd_krw} />

            {/* 매수/매도 추천 */}
            {recommendations && (
              <RecommendSection recommendations={recommendations} onSelect={setSelectedStock} usd_krw={moneyFlow?.korea_rates?.usd_krw} />
            )}

            {/* 투자자 그리드 */}
            <div style={{ marginBottom: 16, display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700 }}>전문 투자자</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>SEC 13F 공개 포트폴리오 기반</span>
            </div>

            {loadingInvestors ? (
              <div className="grid-investors" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <div className="grid-investors" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {investors.map(inv => (
                  <InvestorCard
                    key={inv.id}
                    investor={inv}
                    onClick={() => setSelectedInvestor(inv.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 코인 탭 ── */}
        {activeTab === "crypto" && (
          <div className="fade-in">
            {loadingTab ? (
              <div className="grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} height={120} />)}
              </div>
            ) : (
              <CryptoSection coins={coins} news={cryptoNews} usd_krw={moneyFlow?.korea_rates?.usd_krw} />
            )}
          </div>
        )}

        {/* ── 부동산 탭 ── */}
        {activeTab === "realestate" && (
          <div className="fade-in">
            {loadingTab ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} height={80} />)}
              </div>
            ) : reData ? (
              <RealEstateSection indicators={reData.indicators} news={reData.news} />
            ) : null}
          </div>
        )}
        {/* ── 광물 탭 ── */}
        {activeTab === "commodities" && (
          <div className="fade-in">
            {loadingTab ? (
              <div className="grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} height={140} />)}
              </div>
            ) : commodityData ? (
              <CommoditySection commodities={commodityData.commodities || []} news={commodityData.news || []} usd_krw={moneyFlow?.korea_rates?.usd_krw} />
            ) : null}
          </div>
        )}
      </main>

      {selectedInvestor && (
        <InvestorModal
          investorId={selectedInvestor}
          onClose={() => setSelectedInvestor(null)}
        />
      )}
      {selectedStock && (
        <StockModal ticker={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  InvestorSummary, HotStock, RecommendedStock, CoinData,
  RealEstateIndicator, MoneyFlowAsset, NewsItem, CommodityData,
  WhaleSignal, KoreaRates, BondData,
} from "@/types";
import InvestorModal from "@/components/InvestorModal";
import StockModal from "@/components/StockModal";
import MoneyFlowSection from "@/components/MoneyFlowSection";
import SkeletonCard from "@/components/SkeletonCard";
import WhaleSignalSection from "@/components/WhaleSignalSection";
import MarketsSection from "@/components/MarketsSection";
import NewsAISection from "@/components/NewsAISection";

const API = process.env.NEXT_PUBLIC_API_URL;

type Tab = "signal" | "markets" | "news";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("signal");

  // 공통 데이터
  const [investors, setInvestors] = useState<InvestorSummary[]>([]);
  const [hotStocks, setHotStocks] = useState<HotStock[]>([]);
  const [recommendations, setRecommendations] = useState<{ buy: RecommendedStock[]; sell: RecommendedStock[] } | null>(null);
  const [moneyFlow, setMoneyFlow] = useState<{ assets: MoneyFlowAsset[]; rate_signal: { level: string; message: string }; fed_rate: number; korea_rates?: KoreaRates } | null>(null);
  const [whaleSignal, setWhaleSignal] = useState<WhaleSignal | null>(null);
  const [loadingInvestors, setLoadingInvestors] = useState(true);

  // 마켓 서브 데이터 (lazy)
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [cryptoNews, setCryptoNews] = useState<NewsItem[]>([]);
  const [loadingCrypto, setLoadingCrypto] = useState(false);

  const [reData, setReData] = useState<{ indicators: RealEstateIndicator[]; news: NewsItem[] } | null>(null);
  const [loadingRE, setLoadingRE] = useState(false);

  const [commodityData, setCommodityData] = useState<{ commodities: CommodityData[]; news: NewsItem[] } | null>(null);
  const [loadingCommodity, setLoadingCommodity] = useState(false);

  const [bondData, setBondData] = useState<{ data: BondData; news: NewsItem[] } | null>(null);
  const [loadingBonds, setLoadingBonds] = useState(false);
  const [bondError, setBondError] = useState(false);

  const [selectedInvestor, setSelectedInvestor] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("light");

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  // 초기 로드
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

  // Lazy 로더
  function loadCrypto() {
    if (coins.length > 0) return;
    setLoadingCrypto(true);
    fetch(`${API}/crypto`).then(r => r.json()).then(data => {
      setCoins(data.coins || []);
      setCryptoNews(data.news || []);
    }).finally(() => setLoadingCrypto(false));
  }

  function loadRE() {
    if (reData) return;
    setLoadingRE(true);
    fetch(`${API}/realestate`).then(r => r.json()).then(setReData).finally(() => setLoadingRE(false));
  }

  function loadCommodity() {
    if (commodityData) return;
    setLoadingCommodity(true);
    fetch(`${API}/commodities`).then(r => r.json()).then(setCommodityData).finally(() => setLoadingCommodity(false));
  }

  function loadBonds() {
    if (bondData) return;
    setBondError(false);
    setLoadingBonds(true);
    fetch(`${API}/bonds`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(setBondData)
      .catch(() => setBondError(true))
      .finally(() => setLoadingBonds(false));
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "signal",  label: "Whale Signal" },
    { id: "markets", label: "마켓"         },
    { id: "news",    label: "AI 뉴스"      },
  ];

  // Whale Signal → 마켓 탭 이동 브릿지
  function handleWhaleTabChange(assetTab: string) {
    setActiveTab("markets");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* 헤더 */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 100,
        background: "var(--header-bg)", backdropFilter: "blur(16px)",
      }}>
        <div className="header-inner" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="header-top-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: "var(--accent)", display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>W</span>
              </div>
              <div>
                <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.03em" }}>Whalyx</span>
                <span className="header-right" style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>Whale Tracker</span>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
              style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 6, padding: "5px 10px", cursor: "pointer",
                fontSize: 10, fontWeight: 700, color: "var(--text-secondary)",
                transition: "all 0.15s", flexShrink: 0, letterSpacing: "0.06em",
              }}
            >
              {theme === "dark" ? "LIGHT" : "DARK"}
            </button>
          </div>

          {/* 3탭 네비게이션 */}
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

          <div className="header-right" style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
            13F Filing · Live Markets · AI Insight
          </div>
        </div>
      </header>

      {/* 티커 바 */}
      {moneyFlow && (
        <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}>
          <div style={{
            maxWidth: 1280, margin: "0 auto", padding: "0 24px",
            height: 38, display: "flex", alignItems: "center", gap: 0,
            overflowX: "auto", scrollbarWidth: "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 18px", borderRight: "1px solid var(--border)", flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Fed Rate</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{moneyFlow.fed_rate}%</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>3.50–3.75 target</span>
            </div>
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

        {/* ── Whale Signal ── */}
        {activeTab === "signal" && (
          <div className="fade-in">
            {!whaleSignal ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} height={180} />)}
              </div>
            ) : (
              <WhaleSignalSection data={whaleSignal} onTabChange={handleWhaleTabChange} />
            )}
            {moneyFlow && <MoneyFlowSection data={moneyFlow} korea_rates={moneyFlow.korea_rates} />}
          </div>
        )}

        {/* ── 마켓 (통합) ── */}
        {activeTab === "markets" && (
          <div className="fade-in">
            <MarketsSection
              hotStocks={hotStocks}
              recommendations={recommendations}
              investors={investors}
              loadingInvestors={loadingInvestors}
              onSelectStock={setSelectedStock}
              onSelectInvestor={setSelectedInvestor}
              usd_krw={moneyFlow?.korea_rates?.usd_krw ?? undefined}
              coins={coins}
              cryptoNews={cryptoNews}
              loadingCrypto={loadingCrypto}
              onLoadCrypto={loadCrypto}
              reData={reData}
              loadingRE={loadingRE}
              onLoadRE={loadRE}
              commodityData={commodityData}
              loadingCommodity={loadingCommodity}
              onLoadCommodity={loadCommodity}
              bondData={bondData}
              loadingBonds={loadingBonds}
              bondError={bondError}
              onLoadBonds={loadBonds}
              onRetryBonds={() => { setBondData(null); setBondError(false); loadBonds(); }}
            />
          </div>
        )}

        {/* ── AI 뉴스 ── */}
        {activeTab === "news" && (
          <div className="fade-in">
            <NewsAISection />
          </div>
        )}
      </main>

      {selectedInvestor && (
        <InvestorModal investorId={selectedInvestor} onClose={() => setSelectedInvestor(null)} />
      )}
      {selectedStock && (
        <StockModal ticker={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  );
}

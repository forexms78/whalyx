"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  InvestorSummary, HotStock, RecommendedStock, CoinData,
  RealEstateIndicator, MoneyFlowAsset, NewsItem, CommodityData,
  WhaleSignal, KoreaRates, BondData, ETFSignalsData,
} from "@/types";
import MoneyFlowSection from "@/components/MoneyFlowSection";
import SkeletonCard from "@/components/SkeletonCard";
import WhaleSignalSection from "@/components/WhaleSignalSection";
import MarketsSection from "@/components/MarketsSection";
import ETFStockSection from "@/components/ETFStockSection";
import HeroSection from "@/components/HeroSection";
import PilotsSection from "@/components/PilotsSection";
import TopPerformersSection from "@/components/TopPerformersSection";
import Tooltip from "@/components/Tooltip";
import { useT } from "@/contexts/LanguageContext";

// 클릭 시점에만 chunk 로드 — 초기 번들 크기 축소
const InvestorModal     = dynamic(() => import("@/components/InvestorModal"));
const StockModal        = dynamic(() => import("@/components/StockModal"));
const QuantTab          = dynamic(() => import("@/components/quant/QuantTab"));
const ForeignFlowSection = dynamic(() => import("@/components/ForeignFlowSection"));

const API = process.env.NEXT_PUBLIC_API_URL;

type Tab = "signal" | "markets" | "etfstocks" | "foreign" | "quant";
type MarketTab = "stocks" | "crypto" | "realestate" | "commodities" | "bonds";

const WHALE_TO_MARKET: Record<string, MarketTab> = {
  stocks:      "stocks",
  crypto:      "crypto",
  realestate:  "realestate",
  commodities: "commodities",
  bonds:       "bonds",
};

function fmtTime(d: Date) {
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

export default function Home() {
  const { t, lang, toggleLang } = useT();
  const [activeTab, setActiveTab] = useState<Tab>("signal");
  const [marketSubTab, setMarketSubTab] = useState<MarketTab>("stocks");

  // 공통 데이터
  const [investors, setInvestors] = useState<InvestorSummary[]>([]);
  const [hotStocks, setHotStocks] = useState<HotStock[]>([]);
  const [recommendations, setRecommendations] = useState<{ buy: RecommendedStock[]; sell: RecommendedStock[] } | null>(null);
  const [moneyFlow, setMoneyFlow] = useState<{ assets: MoneyFlowAsset[]; rate_signal: { level: string; message: string }; fed_rate: number; korea_rates?: KoreaRates } | null>(null);
  const [whaleSignal, setWhaleSignal] = useState<WhaleSignal | null>(null);
  const [etfSignals, setEtfSignals] = useState<ETFSignalsData | null>(null);
  const [loadingInvestors, setLoadingInvestors] = useState(true);
  const [initialFetchedAt, setInitialFetchedAt] = useState<Date | null>(null);
  const [marketDrivers, setMarketDrivers] = useState<{ headline: string; impact: string; direction: string; url?: string; source?: string }[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(true);

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

  // Whalyx Top 8 평균 30일 수익률 — 13F 투자자들의 모든 holdings change_30d_pct 평균
  const heroReturn = useMemo(() => {
    if (investors.length === 0) return 12.4;
    const all = investors.flatMap(inv =>
      inv.holdings_data
        .map(h => h.change_30d_pct)
        .filter((v): v is number => v != null)
    );
    if (all.length === 0) return 12.4;
    return all.reduce((s, v) => s + v, 0) / all.length;
  }, [investors]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  // 마켓 드라이버 (초기 로드)
  useEffect(() => {
    fetch(`${API}/market-driver`)
      .then(r => r.json())
      .then(data => setMarketDrivers(data.drivers || []))
      .finally(() => setLoadingDrivers(false));
  }, []);

  // 초기 로드 — ETF·주식 시그널까지 6개 병렬 prefetch
  useEffect(() => {
    Promise.all([
      fetch(`${API}/investors`).then(r => r.json()),
      fetch(`${API}/stocks/hot`).then(r => r.json()),
      fetch(`${API}/stocks/recommendations`).then(r => r.json()),
      fetch(`${API}/money-flow`).then(r => r.json()),
      fetch(`${API}/whale-signal`).then(r => r.json()),
      fetch(`${API}/etf-signals`).then(r => r.json()),
    ]).then(([invData, stockData, recData, flowData, signalData, etfData]) => {
      setInvestors(invData.investors || []);
      setHotStocks(stockData.stocks || []);
      setRecommendations(recData);
      setMoneyFlow(flowData);
      if (signalData?.signals && Array.isArray(signalData.signals)) {
        setWhaleSignal(signalData);
      }
      if (etfData && Array.isArray(etfData.etfs)) {
        setEtfSignals(etfData);
      }
      setInitialFetchedAt(new Date());
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

  // Whale Signal → 마켓 서브탭으로 정확히 이동 (버그 수정)
  function handleWhaleTabChange(assetTab: string) {
    const target = WHALE_TO_MARKET[assetTab];
    if (target) {
      setMarketSubTab(target);
      // 이동할 탭 데이터 선제 로드
      if (target === "crypto"      && coins.length === 0) loadCrypto();
      if (target === "realestate"  && !reData)            loadRE();
      if (target === "commodities" && !commodityData)     loadCommodity();
      if (target === "bonds"       && !bondData)          loadBonds();
    }
    setActiveTab("markets");
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "signal",    label: t("tab.signal")    },
    { id: "markets",   label: t("tab.markets")   },
    { id: "etfstocks", label: t("tab.etfstocks") },
    { id: "foreign",   label: t("tab.foreign")   },
    { id: "quant",     label: t("tab.quant")     },
  ];

  const FED_TOOLTIP = t("tooltip.fed");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {loadingInvestors && (
        <div style={{
          position: "fixed", top: 60, left: 0, right: 0, height: 2, zIndex: 200,
          overflow: "hidden", background: "var(--border)",
        }}>
          <div style={{
            height: "100%", background: "var(--accent)",
            animation: "loadingBar 1.8s ease-in-out infinite", transformOrigin: "left",
          }} />
        </div>
      )}
      {/* 헤더 */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 100,
        background: "var(--header-bg)", backdropFilter: "blur(16px)",
      }}>
        <div className="header-inner" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="header-top-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, textDecoration: "none", color: "inherit" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "var(--accent)", display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>W</span>
              </div>
              <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: "-0.03em" }}>Whalyx</span>
            </Link>
            <button
              onClick={toggleTheme}
              style={{
                background: "var(--bg-2)", border: "1px solid var(--border)",
                borderRadius: 999, padding: "5px 10px", cursor: "pointer",
                fontSize: 10, fontWeight: 700, color: "var(--text-secondary)",
                transition: "all 0.15s", flexShrink: 0, letterSpacing: "0.06em",
              }}
            >
              {theme === "dark" ? t("theme.light") : t("theme.dark")}
            </button>
          </div>

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

          <div className="header-right" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "var(--green)",
              boxShadow: "0 0 8px var(--green)",
              animation: "pulseLive 2.4s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.10em", fontWeight: 700 }}>
              {t("live")}
            </span>
            <button
              onClick={toggleLang}
              title={lang === "ko" ? t("lang.title.toEn") : t("lang.title.toKo")}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "3px 10px",
                fontSize: 10, fontWeight: 700,
                color: "var(--text-secondary)",
                letterSpacing: "0.08em",
                cursor: "pointer",
                transition: "all 0.15s",
                marginLeft: 4,
              }}
            >
              {lang === "ko" ? t("lang.en") : t("lang.ko")}
            </button>
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
            {/* Fed Rate — 툴팁 포함 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 18px", borderRight: "1px solid var(--border)", flexShrink: 0 }}>
              <Tooltip content={FED_TOOLTIP} width={320}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Fed Rate</span>
                <span style={{
                  fontSize: 9, marginLeft: 3, color: "var(--accent)",
                  border: "1px solid var(--accent-glow)", borderRadius: 3,
                  padding: "0 4px", fontWeight: 600,
                }}>?</span>
              </Tooltip>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{moneyFlow.fed_rate}%</span>
              <Tooltip content={t("tooltip.fed.target")} width={260}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", cursor: "help", textDecoration: "underline dotted" }}>3.50–3.75 target</span>
              </Tooltip>
            </div>

            {/* 자산별 30일 수익률 */}
            {moneyFlow.assets.slice(0, 4).map(asset => {
              const chg = asset.change_30d ?? 0;
              const isUp = chg >= 0;
              return (
                <div key={asset.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", borderRight: "1px solid var(--border)", flexShrink: 0 }}>
                  <Tooltip content={`${asset.name}\n\n${asset.description}\n\n${t("tooltip.asset.30d")}`} width={240}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, cursor: "help" }}>{asset.name.split(" ")[0]}</span>
                  </Tooltip>
                  <span style={{ fontSize: 11, fontWeight: 600, color: isUp ? "var(--green)" : "var(--red)" }}>
                    {isUp ? "+" : ""}{chg.toFixed(1)}%
                  </span>
                </div>
              );
            })}

            {/* KRW/USD */}
            {moneyFlow.korea_rates?.usd_krw && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", flexShrink: 0 }}>
                <Tooltip content={`${t("tooltip.krwusd")}\n\n${initialFetchedAt ? `${t("data.refresh")}: ${fmtTime(initialFetchedAt)}` : ""}`} width={240}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, cursor: "help" }}>KRW/USD</span>
                </Tooltip>
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

            {/* 데이터 갱신 시간 */}
            {initialFetchedAt && (
              <div style={{ padding: "0 16px", flexShrink: 0, marginLeft: "auto" }}>
                <Tooltip content={t("tooltip.refresh")} width={220}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", cursor: "help" }}>
                    {t("data.refresh")} {fmtTime(initialFetchedAt)}
                  </span>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>

        {/* Whale Signal — 메인 진입점 */}
        {activeTab === "signal" && (
          <div className="fade-in">
            <HeroSection
              return_pct={heroReturn}
              onCtaClick={() => setActiveTab("etfstocks")}
            />

            {/* 오늘의 마켓 드라이버 */}
            <div style={{ marginBottom: 28 }}>
              {loadingDrivers ? (
                <div className="driver-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {[0,1,2].map(i => <SkeletonCard key={i} height={72} />)}
                </div>
              ) : marketDrivers.length > 0 && (
                <div className="driver-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {marketDrivers.map((d, i) => {
                    const color = d.direction === "bullish" ? "var(--green)" : d.direction === "bearish" ? "var(--red)" : "var(--orange)";
                    const tag = d.direction === "bullish" ? t("tag.bullish") : d.direction === "bearish" ? t("tag.bearish") : t("tag.mixed");
                    return (
                      <a
                        key={i}
                        href={d.url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        <div style={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderLeft: `3px solid ${color}`,
                          borderRadius: 12,
                          padding: "14px 16px",
                          cursor: d.url ? "pointer" : "default",
                          transition: "border-color 0.15s",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                            <span style={{
                              fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                              color, background: `${color}18`,
                              border: `1px solid ${color}40`,
                              borderRadius: 4, padding: "1px 5px",
                            }}>{tag}</span>
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.source}</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.3 }}>
                            {d.headline}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                            {d.impact}
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {!whaleSignal ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} height={180} />)}
              </div>
            ) : (
              <WhaleSignalSection data={whaleSignal} onTabChange={handleWhaleTabChange} />
            )}

            <PilotsSection investors={investors} onSelect={setSelectedInvestor} />
            <TopPerformersSection stocks={hotStocks} onSelect={setSelectedStock} />

            {moneyFlow && <MoneyFlowSection data={moneyFlow} korea_rates={moneyFlow.korea_rates} />}
          </div>
        )}

        {/* 마켓 (통합) */}
        {activeTab === "markets" && (
          <div className="fade-in">
            <MarketsSection
              activeSubTab={marketSubTab}
              onSubTabChange={setMarketSubTab}
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

        {/* ETF · 주식 매수매도 시그널 (prefetched) */}
        {activeTab === "etfstocks" && (
          <ETFStockSection
            onSelect={setSelectedStock}
            usdKrw={moneyFlow?.korea_rates?.usd_krw ?? undefined}
            data={etfSignals}
          />
        )}
        {activeTab === "foreign" && (
          <div className="fade-in">
            <ForeignFlowSection />
          </div>
        )}
        {activeTab === "quant" && (
          <div className="fade-in">
            <QuantTab />
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

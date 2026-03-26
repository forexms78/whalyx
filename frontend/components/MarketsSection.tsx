"use client";
import {
  HotStock, RecommendedStock, CoinData, RealEstateIndicator,
  CommodityData, NewsItem, BondData, KoreaRates,
} from "@/types";
import HotStocksBar from "@/components/HotStocksBar";
import RecommendSection from "@/components/RecommendSection";
import InvestorCard from "@/components/InvestorCard";
import CryptoSection from "@/components/CryptoSection";
import RealEstateSection from "@/components/RealEstateSection";
import CommoditySection from "@/components/CommoditySection";
import BondsSection from "@/components/BondsSection";
import SkeletonCard from "@/components/SkeletonCard";
import { InvestorSummary } from "@/types";

type MarketTab = "stocks" | "crypto" | "realestate" | "commodities" | "bonds";

const MARKET_TABS: { id: MarketTab; label: string }[] = [
  { id: "stocks",      label: "주식"   },
  { id: "crypto",      label: "코인"   },
  { id: "realestate",  label: "부동산" },
  { id: "commodities", label: "광물"   },
  { id: "bonds",       label: "채권"   },
];

interface MarketsProps {
  // 서브탭 제어 (외부에서 주입)
  activeSubTab: MarketTab;
  onSubTabChange: (tab: MarketTab) => void;
  // 주식
  hotStocks: HotStock[];
  recommendations: { buy: RecommendedStock[]; sell: RecommendedStock[] } | null;
  investors: InvestorSummary[];
  loadingInvestors: boolean;
  onSelectStock: (ticker: string) => void;
  onSelectInvestor: (id: string) => void;
  usd_krw?: number;
  // 코인
  coins: CoinData[];
  cryptoNews: NewsItem[];
  loadingCrypto: boolean;
  onLoadCrypto: () => void;
  // 부동산
  reData: { indicators: RealEstateIndicator[]; news: NewsItem[] } | null;
  loadingRE: boolean;
  onLoadRE: () => void;
  // 광물
  commodityData: { commodities: CommodityData[]; news: NewsItem[] } | null;
  loadingCommodity: boolean;
  onLoadCommodity: () => void;
  // 채권
  bondData: { data: BondData; news: NewsItem[] } | null;
  loadingBonds: boolean;
  bondError: boolean;
  onLoadBonds: () => void;
  onRetryBonds: () => void;
}

export default function MarketsSection(props: MarketsProps) {
  const activeTab = props.activeSubTab;

  function handleTabChange(tab: MarketTab) {
    props.onSubTabChange(tab);
    if (tab === "crypto"      && props.coins.length === 0)     props.onLoadCrypto();
    if (tab === "realestate"  && !props.reData)                props.onLoadRE();
    if (tab === "commodities" && !props.commodityData)         props.onLoadCommodity();
    if (tab === "bonds"       && !props.bondData)              props.onLoadBonds();
  }

  return (
    <div>
      {/* 서브 탭 네비게이션 */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 24,
        borderBottom: "1px solid var(--border)", paddingBottom: 0,
      }}>
        {MARKET_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              padding: "8px 18px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 400,
              transition: "all 0.15s",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 주식 */}
      {activeTab === "stocks" && (
        <div className="fade-in">
          <HotStocksBar
            stocks={props.hotStocks}
            onSelect={props.onSelectStock}
            usd_krw={props.usd_krw}
          />
          {props.recommendations && (
            <RecommendSection
              recommendations={props.recommendations}
              onSelect={props.onSelectStock}
              usd_krw={props.usd_krw}
            />
          )}
          <div style={{ marginBottom: 16, display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>전문 투자자</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>SEC 13F 공개 포트폴리오 기반</span>
          </div>
          {props.loadingInvestors ? (
            <div className="grid-investors" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid-investors" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {props.investors.map(inv => (
                <InvestorCard key={inv.id} investor={inv} onClick={() => props.onSelectInvestor(inv.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 코인 */}
      {activeTab === "crypto" && (
        <div className="fade-in">
          {props.loadingCrypto ? (
            <div className="grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} height={120} />)}
            </div>
          ) : (
            <CryptoSection coins={props.coins} news={props.cryptoNews} usd_krw={props.usd_krw} />
          )}
        </div>
      )}

      {/* 부동산 */}
      {activeTab === "realestate" && (
        <div className="fade-in">
          {props.loadingRE ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} height={80} />)}
            </div>
          ) : props.reData ? (
            <RealEstateSection indicators={props.reData.indicators} news={props.reData.news} />
          ) : null}
        </div>
      )}

      {/* 광물 */}
      {activeTab === "commodities" && (
        <div className="fade-in">
          {props.loadingCommodity ? (
            <div className="grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} height={140} />)}
            </div>
          ) : props.commodityData ? (
            <CommoditySection
              commodities={props.commodityData.commodities || []}
              news={props.commodityData.news || []}
              usd_krw={props.usd_krw}
            />
          ) : null}
        </div>
      )}

      {/* 채권 */}
      {activeTab === "bonds" && (
        <div className="fade-in">
          {props.loadingBonds ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} height={80} />)}
            </div>
          ) : props.bondError ? (
            <div style={{
              textAlign: "center", padding: "60px 0",
              color: "var(--text-muted)", fontSize: 13,
            }}>
              채권 데이터를 불러오지 못했습니다.
              <br />
              <button
                onClick={props.onRetryBonds}
                style={{
                  marginTop: 12, padding: "6px 16px", borderRadius: 8,
                  background: "var(--accent-dim)", color: "var(--accent)",
                  border: "1px solid var(--accent-glow)", cursor: "pointer", fontSize: 12,
                }}
              >
                다시 시도
              </button>
            </div>
          ) : props.bondData ? (
            <BondsSection data={props.bondData.data} news={props.bondData.news} />
          ) : null}
        </div>
      )}
    </div>
  );
}

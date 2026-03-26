"use client";
import { useState } from "react";
import { MoneyFlowAsset, KoreaRates } from "@/types";

function Tip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: 4 }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{
        fontSize: 10, color: "var(--text-muted)", cursor: "help",
        width: 14, height: 14, borderRadius: "50%",
        border: "1px solid var(--border)", display: "inline-flex",
        alignItems: "center", justifyContent: "center", lineHeight: 1,
      }}>?</span>
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)", zIndex: 200,
          background: "#1a2235", border: "1px solid #2a3a55",
          borderRadius: 8, padding: "7px 10px",
          fontSize: 11, color: "#94a3b8", whiteSpace: "normal",
          width: 200, lineHeight: 1.6, textAlign: "left",
          pointerEvents: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

interface Props {
  data: {
    assets: MoneyFlowAsset[];
    rate_signal: { level: string; message: string };
    fed_rate: number;
    korea_rates?: KoreaRates;
  };
  korea_rates?: KoreaRates;
}

export default function MoneyFlowSection({ data, korea_rates }: Props) {
  const { assets, rate_signal, fed_rate } = data;
  const resolvedKoreaRates = korea_rates ?? data.korea_rates;
  const signalColor = rate_signal.level === "high" ? "var(--red)" : rate_signal.level === "low" ? "var(--green)" : "var(--gold)";
  const signalBg = rate_signal.level === "high" ? "var(--red-dim)" : rate_signal.level === "low" ? "var(--green-dim)" : "var(--gold-dim)";

  return (
    <div style={{ marginBottom: 32 }}>
      {/* 금리 신호 배너 */}
      <div style={{
        background: signalBg,
        border: `1px solid ${signalColor}33`,
        borderRadius: 12, padding: "16px 24px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{
          fontSize: 28, width: 48, height: 48, borderRadius: 12,
          background: `${signalColor}22`, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {rate_signal.level === "high" ? "🔴" : rate_signal.level === "low" ? "🟢" : "🟡"}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: signalColor, marginBottom: 4 }}>
            돈의 흐름 · Fed 기준금리 {fed_rate}%
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {rate_signal.message}
          </div>
        </div>
      </div>

      {/* 한국/미국 금리 + 환율 비교 */}
      {resolvedKoreaRates && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            한국은행 주요 지표
          </div>
          <div className="grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
            {/* 기준금리 */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center" }}>
                🇰🇷 기준금리
              </div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{resolvedKoreaRates.base_rate != null ? `${resolvedKoreaRates.base_rate.toFixed(2)}%` : "—"}</div>
            </div>
            {/* Fed 금리 */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>🇺🇸 Fed 금리</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{fed_rate}%</div>
            </div>
            {/* 국고채 3년 */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center" }}>
                국고채 3년
                <Tip text="정부가 발행하는 3년 만기 채권. 중기 시장금리의 기준점으로 은행 대출금리·회사채 등에 영향을 줍니다." />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{resolvedKoreaRates.treasury_3y != null ? `${resolvedKoreaRates.treasury_3y.toFixed(2)}%` : "—"}</div>
            </div>
            {/* 국고채 10년 */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center" }}>
                국고채 10년
                <Tip text="정부가 발행하는 10년 만기 채권. 장기 경기 전망과 인플레이션 기대치를 반영합니다. 미국 10년물과의 차이(스프레드)도 중요 지표입니다." />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{resolvedKoreaRates.treasury_10y != null ? `${resolvedKoreaRates.treasury_10y.toFixed(2)}%` : "—"}</div>
            </div>
            {/* CD 91일 */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center" }}>
                CD 91일
                <Tip text="양도성예금증서(Certificate of Deposit). 은행이 발행하는 단기 채권으로 변동금리 대출(주택담보대출 등)의 기준금리로 사용됩니다." />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{resolvedKoreaRates.cd_rate != null ? `${resolvedKoreaRates.cd_rate.toFixed(2)}%` : "—"}</div>
            </div>
            {/* 원/달러 환율 — 변동성 포함 */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>💵 원/달러</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                {resolvedKoreaRates.usd_krw != null ? `${resolvedKoreaRates.usd_krw.toLocaleString("ko-KR")}원` : "—"}
              </div>
              {resolvedKoreaRates.usd_krw_change_1d != null && (
                <div style={{
                  fontSize: 11, fontWeight: 600, marginTop: 3,
                  color: resolvedKoreaRates.usd_krw_change_1d >= 0 ? "var(--red)" : "var(--green)",
                }}>
                  {resolvedKoreaRates.usd_krw_change_1d >= 0 ? "▲" : "▼"} {Math.abs(resolvedKoreaRates.usd_krw_change_1d).toFixed(2)}% 전일 대비
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 자산 카드 그리드 (2~3열) */}
      <div className="grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {assets.map(asset => {
          const chg = asset.change_30d ?? 0;
          const isUp = chg >= 0;
          return (
            <div key={asset.name} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "18px 20px",
              borderTop: `3px solid ${asset.color}`,
              transition: "all 0.15s",
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-light)";
                (e.currentTarget as HTMLDivElement).style.background = "var(--card-hover)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLDivElement).style.background = "var(--card)";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>{asset.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{asset.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{asset.category}</div>
                  </div>
                </div>
                {chg !== 0 && (
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: isUp ? "var(--green)" : "var(--red)",
                    background: isUp ? "var(--green-dim)" : "var(--red-dim)",
                    borderRadius: 8, padding: "4px 10px",
                  }}>
                    {isUp ? "▲" : "▼"} {Math.abs(chg).toFixed(1)}%
                  </span>
                )}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: "var(--text-primary)" }}>{asset.value}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{asset.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

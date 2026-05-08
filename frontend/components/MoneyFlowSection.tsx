"use client";
import { useState } from "react";
import { MoneyFlowAsset, KoreaRates } from "@/types";
import { useT } from "@/contexts/LanguageContext";

// 데이터 없음 표시 + 통상 범위 툴팁
function NullVal({ label, range }: { label: string; range: string }) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4, cursor: "help" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{ color: "var(--text-muted)", fontSize: 14 }}>—</span>
      <span style={{ fontSize: 10, color: "var(--text-muted)", borderBottom: "1px dotted var(--text-muted)" }}>{t("moneyflow.no_data")}</span>
      {show && (
        <span style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          zIndex: 200, background: "#1a2235", border: "1px solid #2a3a55",
          borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#94a3b8",
          whiteSpace: "nowrap", lineHeight: 1.6, pointerEvents: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}>
          <strong style={{ color: "#c8def0" }}>{label}</strong> {t("moneyflow.error")}.<br />
          {t("moneyflow.normal_range")}: <strong style={{ color: "#5b9ec9" }}>{range}</strong>
        </span>
      )}
    </span>
  );
}

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
  const { t, lang } = useT();
  const { assets, rate_signal, fed_rate } = data;
  const resolvedKoreaRates = korea_rates ?? data.korea_rates;
  const signalColor = rate_signal.level === "high" ? "var(--red)" : rate_signal.level === "low" ? "var(--green)" : "var(--gold)";
  const signalBg = rate_signal.level === "high" ? "var(--red-dim)" : rate_signal.level === "low" ? "var(--green-dim)" : "var(--gold-dim)";

  return (
    <div style={{ marginBottom: 32 }}>
      {/* 금리 신호 배너 */}
      <div style={{
        background: signalBg,
        border: `1px solid ${signalColor}44`,
        borderRadius: 12, padding: "14px 20px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 14,
      }}>
        {/* 레벨 배지 */}
        <div style={{
          padding: "5px 12px", borderRadius: 8,
          background: `${signalColor}22`,
          border: `1px solid ${signalColor}55`,
          fontSize: 11, fontWeight: 800, color: signalColor,
          letterSpacing: "0.08em", whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {rate_signal.level === "high" ? "HIGH RATE" : rate_signal.level === "low" ? "LOW RATE" : "MID RATE"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: signalColor, marginBottom: 3 }}>
            {t("moneyflow.flow_title")} {fed_rate}%
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {rate_signal.message}
          </div>
        </div>
      </div>

      {/* 한국/미국 금리 + 환율 비교 */}
      {resolvedKoreaRates && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {t("moneyflow.korea_indicators")}
          </div>
          <div className="grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
            {/* 기준금리 */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center" }}>
                {t("moneyflow.kor_base_rate")}
                <Tip text={t("moneyflow.kor_base_rate.tooltip")} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{resolvedKoreaRates.base_rate != null ? `${resolvedKoreaRates.base_rate.toFixed(2)}%` : <NullVal label={t("moneyflow.kor_base_rate")} range="2.0~3.5%" />}</div>
            </div>
            {/* Fed 금리 */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{t("moneyflow.us_fed_rate")}</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{fed_rate}%</div>
            </div>
            {/* 국고채 3년 */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center" }}>
                {t("moneyflow.treasury_3y")}
                <Tip text={t("moneyflow.treasury_3y.tooltip")} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{resolvedKoreaRates.treasury_3y != null ? `${resolvedKoreaRates.treasury_3y.toFixed(2)}%` : <NullVal label={t("moneyflow.treasury_3y")} range="2.5~4.5%" />}</div>
            </div>
            {/* 국고채 10년 */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center" }}>
                {t("moneyflow.treasury_10y")}
                <Tip text={t("moneyflow.treasury_10y.tooltip")} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{resolvedKoreaRates.treasury_10y != null ? `${resolvedKoreaRates.treasury_10y.toFixed(2)}%` : <NullVal label={t("moneyflow.treasury_10y")} range="3.0~5.0%" />}</div>
            </div>
            {/* CD 91일 */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center" }}>
                {t("moneyflow.cd91")}
                <Tip text={t("moneyflow.cd91.tooltip")} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{resolvedKoreaRates.cd_rate != null ? `${resolvedKoreaRates.cd_rate.toFixed(2)}%` : <NullVal label={t("moneyflow.cd91")} range="3.0~4.5%" />}</div>
            </div>
            {/* 원/달러 환율 — 변동성 포함 */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>KRW/USD</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                {resolvedKoreaRates.usd_krw != null ? `${resolvedKoreaRates.usd_krw.toLocaleString(lang === "ko" ? "ko-KR" : "en-US")}${lang === "ko" ? "원" : ""}` : "—"}
              </div>
              {resolvedKoreaRates.usd_krw_change_1d != null && (
                <div style={{
                  fontSize: 11, fontWeight: 600, marginTop: 3,
                  color: resolvedKoreaRates.usd_krw_change_1d >= 0 ? "var(--red)" : "var(--green)",
                }}>
                  {resolvedKoreaRates.usd_krw_change_1d >= 0 ? "▲" : "▼"} {Math.abs(resolvedKoreaRates.usd_krw_change_1d).toFixed(2)}% {t("moneyflow.prev_day")}
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
                  <div style={{
                    width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                    background: `${asset.color}18`,
                    border: `1px solid ${asset.color}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 800, color: asset.color,
                    letterSpacing: "-0.02em",
                  }}>
                    {asset.icon}
                  </div>
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

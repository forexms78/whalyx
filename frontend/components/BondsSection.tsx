"use client";
import { BondData, NewsItem } from "@/types";

function StatCard({
  label, value, change, unit, note,
}: {
  label: string;
  value: string;
  change?: number | null;
  unit?: string;
  note?: string;
}) {
  const isUp = (change ?? 0) >= 0;
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "18px 20px",
    }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {change != null && (
          <span style={{ fontSize: 12, fontWeight: 600, color: isUp ? "var(--red)" : "var(--green)" }}>
            {isUp ? "+" : ""}{change.toFixed(2)}% 30d
          </span>
        )}
        {unit && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{unit}</span>}
      </div>
      {note && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{note}</div>}
    </div>
  );
}

export default function BondsSection({
  data,
  news,
}: {
  data: BondData;
  news: NewsItem[];
}) {
  const sentColor = data.curve_inverted ? "#ef4444" : "#10b981";

  return (
    <div>
      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>채권 시장</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          미국 국채 금리 · TLT · Fed 기준금리 실시간 현황
        </div>
      </div>

      {/* 수익률 곡선 상태 배너 */}
      <div style={{
        background: data.curve_inverted ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
        border: `1px solid ${sentColor}33`,
        borderRadius: 12,
        padding: "14px 18px",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
          background: `${sentColor}18`, color: sentColor,
          border: `1px solid ${sentColor}44`,
        }}>
          {data.curve_inverted ? "수익률 곡선 역전" : "수익률 곡선 정상"}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {data.curve_inverted
            ? "단기 금리 > 장기 금리 — 경기침체 선행 지표. 방어적 포지션 고려."
            : "장기 금리 > 단기 금리 — 정상 경기 사이클. 위험자산 투자 환경."}
        </span>
      </div>

      {/* 주요 지표 그리드 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 12,
        marginBottom: 28,
      }}>
        <StatCard
          label="Fed 기준금리"
          value={`${data.fed_rate}%`}
          note="목표 3.50~3.75%"
        />
        <StatCard
          label="미 10년 국채 금리"
          value={data.yield_10y != null ? `${data.yield_10y.toFixed(2)}%` : "-"}
          change={data.yield_10y_change}
          unit="장기금리 기준"
        />
        <StatCard
          label="미 3개월 국채 금리"
          value={data.yield_3m != null ? `${data.yield_3m.toFixed(2)}%` : "-"}
          change={data.yield_3m_change}
          unit="단기금리 기준"
        />
        <StatCard
          label="TLT (장기채 ETF)"
          value={data.tlt_price != null ? `$${data.tlt_price.toFixed(2)}` : "-"}
          change={data.tlt_change_30d}
          unit={data.tlt_change_1d != null ? `1d ${data.tlt_change_1d >= 0 ? "+" : ""}${data.tlt_change_1d.toFixed(2)}%` : ""}
        />
      </div>

      {/* 투자 가이드 */}
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "18px 20px",
        marginBottom: 28,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          금리별 채권 투자 시그널
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { condition: "금리 인하 시작", action: "TLT 매수 — 채권 가격 상승 수혜", color: "#10b981" },
            { condition: "금리 동결 장기화", action: "단기채(SHY) 보유 — 이자 수익 확보", color: "#eab308" },
            { condition: "금리 인상 우려", action: "채권 비중 축소, 현금·TIPS 전환", color: "#ef4444" },
            { condition: "수익률 곡선 역전", action: "경기침체 준비 — 방어주·금 분산", color: "#f97316" },
          ].map(item => (
            <div key={item.condition} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                background: `${item.color}18`, color: item.color,
                border: `1px solid ${item.color}33`, flexShrink: 0, marginTop: 1,
              }}>
                {item.condition}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{item.action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 뉴스 */}
      {news.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
            채권 최신 뉴스
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {news.map((n, i) => (
              <a
                key={i}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  overflow: "hidden",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--card-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--card)")}
              >
                <div style={{ display: "flex", gap: 14, padding: "14px 16px", alignItems: "flex-start" }}>
                  {n.image_url && (
                    <div style={{ width: 100, height: 76, flexShrink: 0, borderRadius: 8, overflow: "hidden", background: "var(--border)" }}>
                      <img
                        src={n.image_url}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        onError={e => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = "none"; }}
                      />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, lineHeight: 1.45 }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {n.source} · {new Date(n.published_at).toLocaleDateString("ko-KR")}
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

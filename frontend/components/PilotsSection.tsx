"use client";

import { InvestorSummary } from "@/types";
import { useT } from "@/contexts/LanguageContext";

interface Props {
  investors: InvestorSummary[];
  onSelect: (id: string) => void;
}

export default function PilotsSection({ investors, onSelect }: Props) {
  const { t } = useT();
  if (investors.length === 0) return null;

  return (
    <section style={{ marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 14,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {t("pilots.title")}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {t("pilots.subtitle")}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          gap: 10,
        }}
      >
        {investors.map((inv) => (
          <button
            key={inv.id}
            onClick={() => onSelect(inv.id)}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: "18px 14px",
              cursor: "pointer",
              textAlign: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.borderColor = inv.color + "60";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: inv.color + "1A",
                border: `2px solid ${inv.color}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px",
                fontSize: 22,
                fontWeight: 800,
                color: inv.color,
                letterSpacing: "-0.02em",
              }}
            >
              {inv.avatar_initial}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 2,
                letterSpacing: "-0.01em",
                color: "var(--text-primary)",
              }}
            >
              {inv.name}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                marginBottom: 8,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {inv.firm}
            </div>
            <div
              style={{
                fontSize: 9,
                color: inv.color,
                background: inv.color + "14",
                border: `1px solid ${inv.color}40`,
                borderRadius: 999,
                padding: "2px 8px",
                display: "inline-block",
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              {inv.style}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useT } from "@/contexts/LanguageContext";

type TimeRange = "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";

const RANGES: TimeRange[] = ["1W", "1M", "3M", "YTD", "1Y", "ALL"];

const SEEDS: Record<TimeRange, number[]> = {
  "1W":  [55, 50, 53, 48, 45, 42, 38],
  "1M":  [60, 58, 62, 55, 50, 48, 45, 50, 42, 38, 35, 33, 30, 25],
  "3M":  [70, 65, 68, 60, 58, 55, 50, 55, 48, 45, 40, 38, 35, 32, 30, 28, 25, 22],
  "YTD": [80, 75, 78, 70, 65, 60, 55, 50, 48, 45, 40, 38, 35, 30, 28, 25],
  "1Y":  [85, 80, 75, 78, 70, 68, 65, 60, 55, 50, 45, 40, 38, 35, 30, 28, 25, 22, 20],
  "ALL": [90, 85, 80, 70, 65, 60, 55, 50, 45, 40, 38, 35, 32, 30, 28, 25, 22, 20, 18, 15],
};

interface Props {
  return_pct?: number;
  label?: string;
  description?: string;
  onCtaClick?: () => void;
  ctaLabel?: string;
}

export default function HeroSection({
  return_pct = 12.4,
  label,
  description,
  onCtaClick,
  ctaLabel,
}: Props) {
  const { t } = useT();
  const _label       = label       ?? t("hero.label");
  const _description = description ?? t("hero.description");
  const _ctaLabel    = ctaLabel    ?? t("hero.cta");
  const [range, setRange] = useState<TimeRange>("1M");
  const isUp = return_pct >= 0;
  const accentColor = isUp ? "#10B981" : "#EF4444";

  const path = useMemo(() => buildPath(SEEDS[range]), [range]);

  return (
    <section
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "32px 32px 0",
        marginBottom: 28,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 20,
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              fontWeight: 500,
              letterSpacing: "0.02em",
              marginBottom: 8,
            }}
          >
            {_label}
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.0,
              color: accentColor,
              marginBottom: 6,
            }}
          >
            {isUp ? "+" : ""}
            {return_pct.toFixed(1)}%
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            {_description} · {range}
          </div>
        </div>

        <button
          onClick={onCtaClick}
          style={{
            background: "var(--text-primary)",
            color: "var(--bg)",
            border: "none",
            padding: "12px 22px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            transition: "transform 0.1s, opacity 0.15s",
            letterSpacing: "-0.01em",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.03)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {_ctaLabel} →
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              background: range === r ? "var(--text-primary)" : "transparent",
              color: range === r ? "var(--bg)" : "var(--text-muted)",
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              letterSpacing: "0.02em",
            }}
          >
            {r}
          </button>
        ))}
      </div>

      <div style={{ position: "relative", height: 220, margin: "0 -32px" }}>
        <svg
          viewBox="0 0 800 220"
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          <defs>
            <linearGradient id="hero-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.30" />
              <stop offset="60%" stopColor={accentColor} stopOpacity="0.10" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={path.area} fill="url(#hero-grad)" />
          <path
            d={path.line}
            fill="none"
            stroke={accentColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </section>
  );
}

function buildPath(data: number[]): { line: string; area: string } {
  const W = 800;
  const H = 220;
  const PAD_TOP = 20;
  const PAD_BOTTOM = 12;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const xs = data.map((_, i) => (i / (data.length - 1)) * W);
  const ys = data.map(
    (v) => H - PAD_BOTTOM - ((v - min) / range) * (H - PAD_TOP - PAD_BOTTOM)
  );

  const line = xs
    .map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i].toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  return { line, area };
}

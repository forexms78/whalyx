"use client";
import { useState } from "react";
import { NewsItem } from "@/types";

interface Props {
  news: NewsItem;
}

export default function NewsCard({ news }: Props) {
  const [imgError, setImgError] = useState(false);
  const hasImage = !!news.image_url && !imgError;

  return (
    <a href={news.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
      <div
        style={{
          padding: "12px 16px", background: "var(--card)", borderRadius: 10,
          border: "1px solid var(--border)", transition: "border-color 0.15s",
          display: "flex", gap: 14, alignItems: "center",
        }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent-glow)"}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"}
      >
        {/* 썸네일 또는 placeholder */}
        <div className="news-card-img" style={{
          width: 80, height: 80, flexShrink: 0, borderRadius: 8, overflow: "hidden",
          background: hasImage ? "transparent" : "var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {hasImage ? (
            <img
              src={news.image_url}
              alt=""
              style={{ width: 80, height: 80, objectFit: "cover", display: "block" }}
              onError={() => setImgError(true)}
            />
          ) : (
            <span style={{
              fontSize: 13, fontWeight: 700, color: "var(--accent)",
              letterSpacing: "-0.02em",
            }}>
              {news.source?.slice(0, 3).toUpperCase() || "NEWS"}
            </span>
          )}
        </div>

        {/* 텍스트 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, color: "var(--text-primary)", lineHeight: 1.45, marginBottom: 4,
            overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
          }}>
            {news.title}
          </div>
          {news.description && (
            <div style={{
              fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4, marginBottom: 4,
              overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" as const,
            }}>
              {news.description}
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {news.source} · {news.published_at ? new Date(news.published_at).toLocaleDateString("ko-KR") : ""}
          </div>
        </div>
      </div>
    </a>
  );
}

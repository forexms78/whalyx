"use client";
import { useState } from "react";

export default function Tooltip({
  content,
  children,
  width = 280,
}: {
  content: string;
  children: React.ReactNode;
  width?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "help" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          width,
          background: "#0E1E30",
          color: "#C8DEF0",
          fontSize: 12,
          lineHeight: 1.7,
          padding: "12px 14px",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          border: "1px solid #1E3550",
          zIndex: 9999,
          pointerEvents: "none",
          whiteSpace: "pre-wrap",
        }}>
          {/* 말풍선 꼬리 (위쪽) */}
          <div style={{
            position: "absolute",
            bottom: "100%", left: "50%",
            transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderBottom: "6px solid #1E3550",
          }} />
          {content}
        </div>
      )}
    </span>
  );
}

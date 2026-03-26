"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

export default function Tooltip({
  content,
  children,
  width = 280,
}: {
  content: string;
  children: React.ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const show = useCallback(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      top: r.bottom + window.scrollY + 8,
      left: r.left + window.scrollX + r.width / 2,
    });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  return (
    <span
      ref={ref}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "help" }}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {mounted && pos && createPortal(
        <div style={{
          position: "absolute",
          top: pos.top,
          left: pos.left,
          transform: "translateX(-50%)",
          width,
          background: "#0E1E30",
          color: "#C8DEF0",
          fontSize: 12,
          lineHeight: 1.7,
          padding: "12px 14px",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
          border: "1px solid #2A4A6A",
          zIndex: 99999,
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
            borderBottom: "6px solid #2A4A6A",
          }} />
          {content}
        </div>,
        document.body
      )}
    </span>
  );
}

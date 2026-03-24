"use client";

import { useState } from "react";

interface Props {
  report: string;
  feedback: string | null;
}

export default function ReportSection({ report, feedback }: Props) {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#fff",
        border: "1px solid #E4E6EB",
        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
      }}
    >
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid #E4E6EB" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "#1C1E21" }}>
          AI 리스크 리포트
        </h3>
        {feedback && (
          <button
            onClick={() => setShowFeedback(!showFeedback)}
            className="text-xs underline"
            style={{ color: "#1877F2" }}
          >
            PM 피드백 {showFeedback ? "숨기기" : "보기"}
          </button>
        )}
      </div>

      {showFeedback && feedback && (
        <div
          className="px-5 py-3 text-xs"
          style={{
            background: "#E7F3FF",
            borderBottom: "1px solid #B0C8F7",
            color: "#1877F2",
          }}
        >
          <strong>PM 검토:</strong> {feedback}
        </div>
      )}

      <div className="px-5 py-5">
        <p
          className="text-sm whitespace-pre-wrap leading-relaxed"
          style={{ color: "#3E4042" }}
        >
          {report}
        </p>
      </div>
    </div>
  );
}

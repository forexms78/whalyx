"use client";

import { useState } from "react";

interface Props {
  report: string;
  feedback: string | null;
}

export default function ReportSection({ report, feedback }: Props) {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">AI 리스크 리포트</h3>
        {feedback && (
          <button
            onClick={() => setShowFeedback(!showFeedback)}
            className="text-xs text-gray-500 hover:text-gray-300 underline"
          >
            PM 피드백 {showFeedback ? "숨기기" : "보기"}
          </button>
        )}
      </div>

      {showFeedback && feedback && (
        <div className="px-5 py-3 bg-blue-900/20 border-b border-blue-800/30 text-xs text-blue-300">
          <strong>PM 검토:</strong> {feedback}
        </div>
      )}

      <div className="px-5 py-5">
        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{report}</p>
      </div>
    </div>
  );
}

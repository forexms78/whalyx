"use client";

interface Props {
  report: string;
}

export default function ReportSection({ report }: Props) {

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
      </div>

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

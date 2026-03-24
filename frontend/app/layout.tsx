import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "War-Investment Agent | 지정학 리스크 포트폴리오 분석",
  description: "OMS 16-Agent 오케스트레이션 시스템으로 지정학 리스크를 분석하여 포트폴리오 위험도를 평가합니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

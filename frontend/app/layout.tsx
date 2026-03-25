import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhaleTracks | 세계 최고 투자자들의 포트폴리오",
  description: "캐시 우드, 워런 버핏, 젠슨 황 등 세계적 투자자들의 최신 포트폴리오와 매수·매도 동향을 실시간으로 확인하세요.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

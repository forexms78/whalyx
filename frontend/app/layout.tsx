import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Whalyx | Whale Tracker",
  description: "워런 버핏·드러켄밀러 등 SEC 13F 기관 투자자의 매수·매도 동향을 실시간으로 추적하세요. 금리·주식·코인·부동산 자금 흐름 한눈에 파악.",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

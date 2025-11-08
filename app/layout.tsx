import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Forex Trading Bot - MetaTrader5",
  description: "Advanced AI-powered forex trading bot with MT5 integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

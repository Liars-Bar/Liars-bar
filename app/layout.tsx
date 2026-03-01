import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import { WalletProvider } from "@/components/providers/WalletProvider";
import { RetroWallet } from "./RetroWallet";
import "./globals.css";
import "./retro.css";

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

export const metadata: Metadata = {
  title: "Liar's Bar",
  description: "A game of deception and strategy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <WalletProvider>
          <div
            className={`${pixelFont.variable}`}
            style={{
              fontFamily: "var(--font-pixel), monospace",
              height: "100dvh",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* CRT Scanline Overlay */}
            <div className="crt-overlay" />
            {/* Retro Wallet Connect — Top Right */}
            <RetroWallet />
            {/* Screen Content */}
            <div className="crt-screen screen-flicker" style={{ height: "100%", overflow: "hidden" }}>
              {children}
            </div>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}

import { Press_Start_2P } from "next/font/google";
import { RetroWallet } from "./RetroWallet";
import "./retro.css";

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

export default function RetroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
  );
}

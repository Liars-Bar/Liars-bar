import { Press_Start_2P } from "next/font/google";
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
    <div className={`${pixelFont.variable}`} style={{ fontFamily: "var(--font-pixel), monospace" }}>
      {/* CRT Scanline Overlay */}
      <div className="crt-overlay" />
      {/* Screen Content */}
      <div className="crt-screen screen-flicker">
        {children}
      </div>
    </div>
  );
}

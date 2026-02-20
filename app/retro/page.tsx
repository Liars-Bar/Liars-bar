"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCreateTable } from "@/lib/solana/useCreateTable";

const ASCII_LOGO = `
 ██▓     ██▓ ▄▄▄       ██▀███    ██████
▓██▒    ▓██▒▒████▄    ▓██ ▒ ██▒▒██    ▒
▒██░    ▒██▒▒██  ▀█▄  ▓██ ░▄█ ▒░ ▓██▄
▒██░    ░██░░██▄▄▄▄██ ▒██▀▀█▄    ▒   ██▒
░██████▒░██░ ▓█   ▓██▒░██▓ ▒██▒▒██████▒▒
░ ▒░▓  ░░▓   ▒▒   ▓▒█░░ ▒▓ ░▒▓░▒ ▒▓▒ ▒ ░
░ ░ ▒  ░ ▒ ░  ▒   ▒▒ ░  ░▒ ░ ▒░░ ░▒  ░ ░
  ░ ░    ▒ ░  ░   ▒     ░░   ░ ░  ░  ░
    ░  ░ ░        ░  ░   ░           ░
`;

const CARD_ART = [
  "┌─────┐",
  "│ A   │",
  "│  ♠  │",
  "│   A │",
  "└─────┘",
];

// ── Splash Screen Boot Lines ────────────────────────────────
const BOOT_LINES = [
  { text: "BIOS v1.0.0 - LIAR'S BAR SYSTEM", color: "#39ff14", delay: 0 },
  { text: "COPYRIGHT (C) 2026 BLOCKCHAIN ARCADE CO.", color: "#666", delay: 200 },
  { text: "", color: "#666", delay: 300 },
  { text: "CHECKING MEMORY.......... 640K OK", color: "#39ff14", delay: 500 },
  { text: "INITIALIZING SOLANA NODE. OK", color: "#39ff14", delay: 800 },
  { text: "CONNECTING INCO NETWORK.. OK", color: "#39ff14", delay: 1100 },
  { text: "LOADING CARD DECK........ 52 CARDS FOUND", color: "#22d3ee", delay: 1400 },
  { text: "SHUFFLING ALGORITHMS..... LOADED", color: "#22d3ee", delay: 1700 },
  { text: "ENCRYPTION MODULE........ ACTIVE", color: "#fbbf24", delay: 2000 },
  { text: "WALLET ADAPTER........... READY", color: "#fbbf24", delay: 2300 },
  { text: "", color: "#666", delay: 2500 },
  { text: "ALL SYSTEMS NOMINAL.", color: "#39ff14", delay: 2700 },
];

const SPLASH_LOGO = `
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║     ██╗     ██╗ █████╗ ██████╗ ███╗   ║
    ║     ██║     ██║██╔══██╗██╔══██╗██╔╝   ║
    ║     ██║     ██║███████║██████╔╝███║    ║
    ║     ██║     ██║██╔══██║██╔══██╗╚██║    ║
    ║     ███████╗██║██║  ██║██║  ██║ ███╗   ║
    ║     ╚══════╝╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══╝  ║
    ║              B   A   R                ║
    ║                                       ║
    ╚═══════════════════════════════════════╝`;

const TOTAL_BOOT_TIME = 3000; // ms for all boot lines
const LOGO_APPEAR_TIME = TOTAL_BOOT_TIME + 400;
const PRESS_START_TIME = LOGO_APPEAR_TIME + 800;

// ── Splash Screen Component ─────────────────────────────────
function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [bootPhase, setBootPhase] = useState<"boot" | "logo" | "ready">("boot");
  const [progress, setProgress] = useState(0);
  const [skipReady, setSkipReady] = useState(false);

  // Boot line typing
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    BOOT_LINES.forEach((line, i) => {
      timers.push(
        setTimeout(() => setVisibleLines(i + 1), line.delay)
      );
    });

    // Progress bar fills during boot
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 2, 100));
    }, TOTAL_BOOT_TIME / 50);

    // Show logo after boot
    timers.push(setTimeout(() => setBootPhase("logo"), LOGO_APPEAR_TIME));

    // Show PRESS START
    timers.push(setTimeout(() => {
      setBootPhase("ready");
      setProgress(100);
    }, PRESS_START_TIME));

    // Allow skip after a moment
    timers.push(setTimeout(() => setSkipReady(true), 800));

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(progressInterval);
    };
  }, []);

  const handleSkip = useCallback(() => {
    if (skipReady) onComplete();
  }, [skipReady, onComplete]);

  // Click or key to skip/continue
  useEffect(() => {
    const handler = () => {
      if (bootPhase === "ready" || skipReady) {
        onComplete();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [bootPhase, skipReady, onComplete]);

  return (
    <div
      className="absolute inset-0 z-50 bg-[#0a0a0a] flex flex-col overflow-hidden cursor-pointer"
      onClick={handleSkip}
      style={{ height: "100%" }}
    >
      {/* Boot Phase */}
      {bootPhase === "boot" && (
        <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-hidden">
          {/* Boot text lines */}
          <div className="flex-1 overflow-hidden">
            {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
              <div
                key={i}
                className="text-[8px] sm:text-[10px] leading-relaxed"
                style={{ color: line.color, fontFamily: "'Press Start 2P', monospace" }}
              >
                {line.text || "\u00A0"}
              </div>
            ))}
            {visibleLines < BOOT_LINES.length && (
              <span className="text-[10px] neon-green blink">_</span>
            )}
          </div>

          {/* Progress bar at bottom */}
          <div className="flex-shrink-0 mt-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-green-600 text-[8px]">LOADING:</span>
              <div className="flex-1 h-4 border-2 border-green-600 bg-[#0a0a0a] relative overflow-hidden" style={{ maxWidth: "300px" }}>
                <div
                  className="h-full transition-all duration-100"
                  style={{
                    width: `${progress}%`,
                    background: "repeating-linear-gradient(90deg, #39ff14 0px, #39ff14 6px, transparent 6px, transparent 9px)",
                  }}
                />
              </div>
              <span className="text-green-600 text-[8px] w-10 text-right">{progress}%</span>
            </div>
            <p className="text-green-900 text-[7px]">PRESS ANY KEY TO SKIP...</p>
          </div>
        </div>
      )}

      {/* Logo Phase */}
      {bootPhase !== "boot" && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 splash-screen-in">
          {/* Big ASCII Logo */}
          <pre
            className="neon-green text-[5px] sm:text-[7px] md:text-[9px] leading-tight text-center select-none mb-4"
            style={{
              filter: bootPhase === "logo" ? "brightness(2)" : "brightness(1)",
              transition: "filter 0.5s ease-out",
            }}
          >
            {SPLASH_LOGO}
          </pre>

          {/* Tagline */}
          <p className="text-green-600 text-[8px] sm:text-[10px] mb-2 tracking-widest">
            A GAME OF DECEPTION & STRATEGY
          </p>
          <p className="text-green-900 text-[7px] sm:text-[8px] mb-8">
            POWERED BY SOLANA & INCO NETWORK
          </p>

          {/* Decorative cards */}
          <div className="flex gap-6 mb-8 opacity-50">
            <pre className="text-cyan-400 text-[6px] sm:text-[7px] leading-tight">
{`┌─────┐
│ A ♠ │
│     │
│ ♠ A │
└─────┘`}
            </pre>
            <pre className="text-red-400 text-[6px] sm:text-[7px] leading-tight">
{`┌─────┐
│ K ♥ │
│     │
│ ♥ K │
└─────┘`}
            </pre>
            <pre className="text-cyan-400 text-[6px] sm:text-[7px] leading-tight">
{`┌─────┐
│ Q ♦ │
│     │
│ ♦ Q │
└─────┘`}
            </pre>
          </div>

          {/* PRESS START - only when ready */}
          {bootPhase === "ready" && (
            <div className="text-center">
              <p className="neon-amber text-[10px] sm:text-xs blink tracking-[6px]">
                PRESS START
              </p>
              <p className="text-green-900 text-[7px] mt-3">
                CLICK ANYWHERE OR PRESS ANY KEY
              </p>
            </div>
          )}

          {/* Credits line */}
          <div className="absolute bottom-4 inset-x-0 text-center">
            <p className="text-green-950 text-[6px] sm:text-[7px]">
              (C) 2026 LIAR&apos;S BAR // BLOCKCHAIN EDITION v1.0.0
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stars Background ────────────────────────────────────────
function StarField() {
  const [stars, setStars] = useState<
    { id: number; x: number; y: number; delay: number; size: number }[]
  >([]);

  useEffect(() => {
    setStars(
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 5,
        size: Math.random() > 0.7 ? 2 : 1,
      })),
    );
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-green-400"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: 0.3,
            animation: `twinkle ${2 + star.delay}s ease-in-out ${star.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// ███ MAIN HOME PAGE ████████████████████████████████████████
// ═════════════════════════════════════════════════════════════
export default function RetroHome() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [tableId, setTableId] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);

  const { createTable, isLoading: isCreating, error: createError } = useCreateTable(
    (createdTableId) => {
      router.push(`/retro/table/${createdTableId}`);
    }
  );

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    // Small delay for the menu fade-in
    setTimeout(() => setMenuVisible(true), 50);
  }, []);

  const handleCreateTable = async () => {
    if (!connected || !publicKey) return;
    await createTable();
  };

  const handleJoinTable = () => {
    if (!connected || !publicKey) return;
    if (!tableId.trim()) {
      setJoinError(">> ERROR: TABLE ID REQUIRED");
      return;
    }
    setIsNavigating(true);
    router.push(`/retro/table/${tableId.trim()}`);
  };

  const showLoadingOverlay = isCreating || isNavigating;

  return (
    <div className="bg-[#0a0a0a] grid-bg relative overflow-hidden flex flex-col" style={{ height: "100%" }}>
      <StarField />

      {/* ═══ SPLASH SCREEN ════════════════════════════════ */}
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}

      {/* ═══ LOADING TABLE OVERLAY ════════════════════════ */}
      {showLoadingOverlay && (
        <div className="absolute inset-0 z-50 bg-[#0a0a0a] flex flex-col items-center justify-center">
          <pre className="text-green-400 text-xs mb-8 text-center">
{`   ╔══════════════════════╗
   ║   LOADING TABLE...   ║
   ╚══════════════════════╝`}
          </pre>
          <div className="retro-loading-bar mb-6" />
          <p className="neon-green text-[10px]">
            {isCreating ? ">> CONFIRM TX IN WALLET" : ">> ENTERING GAME LOBBY"}
          </p>
          <span className="neon-green text-[10px] mt-2 blink">_</span>
        </div>
      )}

      {/* ═══ MAIN MENU ═══════════════════════════════════ */}
      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 overflow-y-auto retro-scroll"
        style={{
          opacity: menuVisible && !showSplash ? 1 : 0,
          transition: "opacity 0.5s ease-in",
        }}
      >
        {/* ASCII Logo */}
        <pre
          className="neon-green text-[6px] sm:text-[8px] md:text-[10px] leading-tight mb-2 text-center select-none"
          aria-hidden="true"
        >
          {ASCII_LOGO}
        </pre>

        {/* Subtitle */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-green-800 text-[8px]">════════════</span>
          <span className="neon-amber text-[10px] sm:text-xs tracking-widest">B A R</span>
          <span className="text-green-800 text-[8px]">════════════</span>
        </div>
        <p className="text-green-600 text-[8px] sm:text-[10px] mb-1">A GAME OF DECEPTION & STRATEGY</p>
        <p className="text-green-900 text-[8px] mb-8">POWERED BY SOLANA & INCO NETWORK</p>

        {/* Card Art Decoration */}
        <div className="flex gap-4 mb-8 opacity-60">
          {[0, 1, 2].map((i) => (
            <pre key={i} className="text-cyan-400 text-[7px] sm:text-[8px] leading-tight">
              {CARD_ART.join("\n")}
            </pre>
          ))}
        </div>

        {/* Connection Status */}
        <div className="mb-6 text-center">
          {connected ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full blink" />
              <span className="text-green-400 text-[10px]">
                WALLET: {publicKey?.toString().slice(0, 6)}...{publicKey?.toString().slice(-4)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="neon-red text-[10px]">WALLET DISCONNECTED</span>
            </div>
          )}
        </div>

        {/* Menu */}
        {!showJoinInput ? (
          <div className="flex flex-col items-center gap-4 w-full max-w-md">
            <pre className="text-green-600 text-[8px] text-center mb-2">
{`╔══════════════════════════════╗
║       SELECT  OPTION         ║
╚══════════════════════════════╝`}
            </pre>

            <button
              onClick={handleCreateTable}
              disabled={isCreating || !connected}
              className="retro-btn retro-btn-amber w-full max-w-xs"
            >
              {isCreating ? ">> CREATING..." : ">> CREATE TABLE"}
            </button>

            <button
              onClick={() => setShowJoinInput(true)}
              disabled={!connected}
              className="retro-btn retro-btn-cyan w-full max-w-xs"
            >
              {">> JOIN TABLE"}
            </button>

            {!connected && (
              <div className="pixel-border-amber p-3 mt-2">
                <p className="neon-amber text-[9px] text-center">
                  ! CONNECT WALLET TO PLAY !
                </p>
              </div>
            )}

            {createError && (
              <div className="pixel-border-red p-3 mt-2">
                <p className="neon-red text-[9px] text-center">{createError}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full max-w-md pixel-fade-in">
            <pre className="text-green-600 text-[8px] text-center mb-2">
{`╔══════════════════════════════╗
║     ENTER TABLE ID           ║
╚══════════════════════════════╝`}
            </pre>

            <input
              type="text"
              value={tableId}
              onChange={(e) => { setTableId(e.target.value); setJoinError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleJoinTable()}
              placeholder="TABLE_ID_HERE"
              className="retro-input w-full max-w-xs"
            />

            {joinError && (
              <p className="neon-red text-[9px]">{joinError}</p>
            )}

            <div className="flex gap-3">
              <button onClick={handleJoinTable} className="retro-btn retro-btn-amber">
                JOIN
              </button>
              <button
                onClick={() => { setShowJoinInput(false); setTableId(""); setJoinError(""); }}
                className="retro-btn retro-btn-red"
              >
                BACK
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="flex items-center gap-2 justify-center mb-2">
            <span className="text-green-900 text-[8px]">────────</span>
            <span className="text-green-700 text-[8px]">INSERT COIN</span>
            <span className="text-green-900 text-[8px]">────────</span>
          </div>
          <p className="text-green-900 text-[7px]">(C) 2026 LIAR&apos;S BAR - ALL RIGHTS RESERVED</p>
          <p className="text-green-950 text-[6px] mt-1">v1.0.0 // BLOCKCHAIN EDITION</p>
        </div>
      </div>
    </div>
  );
}

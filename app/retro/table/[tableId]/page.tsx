"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useTable } from "@/lib/solana/useTable";

// ── Character Data ──────────────────────────────────────────────
const CHARACTER_MAP: Record<
  string,
  { name: string; image: string; ascii: string; color: string; border: string }
> = {
  bull: {
    name: "BULL",
    image: "/charactres/bull.png",
    ascii: "(\\/)o_O(\\/)",
    color: "#ef4444",
    border: "border-red-500",
  },
  cat: {
    name: "CAT",
    image: "/charactres/cat.png",
    ascii: " /\\_/\\  >^.^<",
    color: "#a855f7",
    border: "border-purple-500",
  },
  dog: {
    name: "DOG",
    image: "/charactres/dog.png",
    ascii: "  / \\__U o.o",
    color: "#f59e0b",
    border: "border-amber-500",
  },
  lion: {
    name: "LION",
    image: "/charactres/lions.png",
    ascii: " /\\_/\\  =^.^=",
    color: "#eab308",
    border: "border-yellow-500",
  },
  pig: {
    name: "PIG",
    image: "/charactres/pig.png",
    ascii: "  (o^.^o)  ~",
    color: "#ec4899",
    border: "border-pink-500",
  },
  rabbit: {
    name: "RABBIT",
    image: "/charactres/rabbit.png",
    ascii: " (\\(\\  (-.-)o",
    color: "#94a3b8",
    border: "border-slate-400",
  },
  wolf: {
    name: "WOLF",
    image: "/charactres/wolf.png",
    ascii: "  /\\  W(o.o)W",
    color: "#64748b",
    border: "border-slate-500",
  },
};

const CHARACTERS_LIST = [
  { id: "bull", name: "BULL", image: "/charactres/bull.png", color: "#ef4444" },
  { id: "cat", name: "CAT", image: "/charactres/cat.png", color: "#a855f7" },
  { id: "dog", name: "DOG", image: "/charactres/dog.png", color: "#f59e0b" },
  {
    id: "lion",
    name: "LION",
    image: "/charactres/lions.png",
    color: "#eab308",
  },
  { id: "pig", name: "PIG", image: "/charactres/pig.png", color: "#ec4899" },
  {
    id: "rabbit",
    name: "RABBIT",
    image: "/charactres/rabbit.png",
    color: "#94a3b8",
  },
  { id: "wolf", name: "WOLF", image: "/charactres/wolf.png", color: "#64748b" },
];

// ── Card helpers ────────────────────────────────────────────────
const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"];
const SUIT_COLORS = ["#22d3ee", "#ef4444", "#ef4444", "#22d3ee"];
const VALUE_LABELS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
const TABLE_CARD_NAMES = [
  "ACE",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "JACK",
  "QUEEN",
  "KING",
];

// ASCII card art for the table card display
const TABLE_CARD_LABELS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const TABLE_CARD_SUITS = ["♠", "♥", "♦", "♣"];

function getTableCardArt(cardIndex: number): string[] {
  const label = TABLE_CARD_LABELS[cardIndex] ?? "?";
  const pad = label.length > 1 ? "" : " "; // "10" needs less padding
  if (label.length > 1) {
    return [
      "┌───────┐",
      `│ ${label}    │`,
      "│       │",
      `│   ${TABLE_CARD_SUITS[0]}   │`,
      "│       │",
      `│    ${label} │`,
      "└───────┘",
    ];
  }
  return [
    "┌───────┐",
    `│ ${label}     │`,
    "│       │",
    `│   ${TABLE_CARD_SUITS[0]}   │`,
    "│       │",
    `│     ${label} │`,
    "└───────┘",
  ];
}

// ── Player seat positions (2D top-down) ─────────────────────────
function getSeatPositions(count: number, myIndex: number) {
  const positions: { top: string; left: string; align: string }[] = [];
  const angleStep = (2 * Math.PI) / count;
  const startAngle = (3 * Math.PI) / 2;

  for (let i = 0; i < count; i++) {
    const posIndex = (i - myIndex + count) % count;
    const angle = startAngle + posIndex * angleStep;
    const top = 50 - 38 * Math.sin(angle);
    const left = 50 + 38 * Math.cos(angle);
    positions.push({
      top: `${Math.round(top)}%`,
      left: `${Math.round(left)}%`,
      align: left > 55 ? "left" : left < 45 ? "right" : "center",
    });
  }
  return positions;
}

// ── Star Background ─────────────────────────────────────────────
function StarField() {
  const [stars, setStars] = useState<
    { id: number; x: number; y: number; delay: number; size: number }[]
  >([]);

  useEffect(() => {
    setStars(
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 4,
        size: Math.random() > 0.8 ? 2 : 1,
      })),
    );
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-green-400"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: 0.2,
            animation: `twinkle ${2 + s.delay}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ███ MAIN PAGE COMPONENT ██████████████████████████████████████
// ═══════════════════════════════════════════════════════════════
export default function RetroTablePage() {
  const params = useParams();
  const router = useRouter();
  const tableId = params.tableId as string;
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [selectedCardIndices, setSelectedCardIndices] = useState<number[]>([]);
  const [pendingAction, setPendingAction] = useState<"place" | "liar" | null>(null);

  const handleCopyTableId = async () => {
    await navigator.clipboard.writeText(tableId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const {
    tableData,
    isLoading,
    error,
    isPlayerInTable,
    takenCharacters,
    joinTable,
    isJoining,
    startRound,
    isStarting,
    canStart,
    gameState,
    quitTable,
    isQuitting,
    shouldShowShuffleButton,
    shuffleCards,
    isShuffling,
    myCards,
    myEncryptedCards,
    isDecryptingCards,
    lastClaimBy,
    liarCaller,
    isOver,
    isMyTurn,
    currentTurnPlayer,
    placeCards,
    callLiar,
    isPlacingCards,
    isCallingLiar,
    // WebSocket event system
    wsEventLog,
    activeAnimation,
    connectionStatus,
  } = useTable(tableId);

  // Track eliminated players from the WS game state
  const eliminatedPlayers = useMemo(() => {
    const eliminated = new Set<string>();
    for (const entry of wsEventLog) {
      if (entry.type === "playerEleminated" && entry.player) {
        eliminated.add(entry.player);
      }
    }
    return eliminated;
  }, [wsEventLog]);

  // Auto-scroll event log
  const eventLogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [wsEventLog]);

  // Fetch balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!publicKey) {
        setBalance(null);
        return;
      }
      try {
        const bal = await connection.getBalance(publicKey);
        setBalance(bal / LAMPORTS_PER_SOL);
      } catch {
        /* ignore */
      }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  // Reset selected cards when a new round begins
  const prevGameState = useRef(gameState);
  useEffect(() => {
    if (prevGameState.current !== "playing" && gameState === "playing") {
      setSelectedCardIndices([]);
    }
    prevGameState.current = gameState;
  }, [gameState]);

  const handleLeaveTable = async () => {
    const success = await quitTable();
    if (success) router.push("/retro");
  };

  const handleJoin = async () => {
    if (!selectedCharacter) return;
    const success = await joinTable(selectedCharacter);
    if (success) setSelectedCharacter(null);
  };

  const handleCardClick = (index: number) => {
    setSelectedCardIndices((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      if (prev.length >= myCards.length) return [...prev.slice(1), index];
      return [...prev, index];
    });
  };

  const handlePlaceCards = async () => {
    if (selectedCardIndices.length === 0) return;
    const success = await placeCards(selectedCardIndices);
    if (success) {
      setSelectedCardIndices([]);
    }
  };

  const currentPlayerIndex =
    tableData?.players.findIndex((p) => p === publicKey?.toString()) ?? 0;
  const playersWithCharacters =
    tableData?.playerInfos.filter((p) => p.characterId) ?? [];
  const playerCount = playersWithCharacters.length;
  const positions = getSeatPositions(
    Math.max(playerCount, 1),
    currentPlayerIndex >= 0 ? currentPlayerIndex : 0,
  );

  const playersWithPositions = playersWithCharacters.map(
    (playerInfo, index) => {
      const character = playerInfo.characterId
        ? CHARACTER_MAP[playerInfo.characterId]
        : null;
      const pos = positions[index] || {
        top: "50%",
        left: "50%",
        align: "center",
      };
      return {
        address: playerInfo.address,
        characterId: playerInfo.characterId,
        name: character?.name || "???",
        image: character?.image || "/charactres/bull.png",
        color: character?.color || "#666",
        border: character?.border || "border-gray-500",
        top: pos.top,
        left: pos.left,
        isCurrentPlayer: playerInfo.address === publicKey?.toString(),
      };
    },
  );

  // ── LOADING ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="bg-[#0a0a0a] grid-bg flex flex-col items-center justify-center"
        style={{ height: "100%" }}
      >
        <StarField />
        <div className="relative z-10 flex flex-col items-center">
          <pre className="neon-green text-[10px] mb-6 text-center">
            {`╔═══════════════════════╗
║    LOADING TABLE...   ║
╚═══════════════════════╝`}
          </pre>
          <div className="retro-loading-bar mb-4" />
          <p className="text-green-700 text-[8px] mb-2">
            CONNECTING TO BLOCKCHAIN...
          </p>
          <span className="neon-green text-[10px] blink">_</span>
        </div>
      </div>
    );
  }

  // ── ERROR ───────────────────────────────────────────────────
  if (error && !tableData) {
    return (
      <div
        className="bg-[#0a0a0a] grid-bg flex flex-col items-center justify-center px-4"
        style={{ height: "100%" }}
      >
        <StarField />
        <div className="relative z-10 flex flex-col items-center">
          <pre className="neon-red text-[10px] mb-4 text-center">
            {`╔═══════════════════════════╗
║   !! TABLE NOT FOUND !!   ║
╚═══════════════════════════╝`}
          </pre>
          <p className="text-red-400 text-[9px] mb-6 text-center max-w-sm">
            {error}
          </p>
          <a href="/retro" className="retro-btn retro-btn-amber">
            {"<< BACK TO MENU"}
          </a>
        </div>
      </div>
    );
  }

  // ── CHARACTER SELECT ────────────────────────────────────────
  if (!isPlayerInTable && tableData?.isOpen) {
    return (
      <div
        className="bg-[#0a0a0a] grid-bg relative overflow-hidden flex flex-col"
        style={{ height: "100%" }}
      >
        <StarField />

        {/* Top HUD */}
        <div
          className="relative z-30 flex items-center justify-between px-3 py-2 flex-shrink-0 hud-bar"
          style={{ borderBottom: "2px solid #1a3a1a" }}
        >
          <span className="text-green-700 text-[8px]">
            LIAR&apos;S BAR // CHARACTER SELECT
          </span>
          <button
            onClick={handleCopyTableId}
            className="text-green-700 text-[7px] hover:text-green-400 transition"
          >
            ID: {tableId.slice(0, 6)}... {copied ? "[COPIED!]" : "[COPY]"}
          </button>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 overflow-y-auto retro-scroll">
          <pre className="neon-green text-[8px] sm:text-[10px] mb-4 text-center">
            {`╔════════════════════════════╗
║     SELECT CHARACTER       ║
╚════════════════════════════╝`}
          </pre>

          {!connected && (
            <div className="pixel-border-amber p-3 mb-4">
              <p className="neon-amber text-[9px]">! CONNECT WALLET FIRST !</p>
            </div>
          )}

          {/* Character Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 max-w-lg">
            {CHARACTERS_LIST.map((char) => {
              const isTaken = takenCharacters.includes(char.id);
              const isSelected = selectedCharacter === char.id;
              return (
                <button
                  key={char.id}
                  onClick={() => !isTaken && setSelectedCharacter(char.id)}
                  disabled={!connected || isJoining || isTaken}
                  className={`
                    flex flex-col items-center p-3 transition-all
                    ${
                      isSelected
                        ? "bg-[#1a1a2e]"
                        : isTaken
                          ? "opacity-30 cursor-not-allowed bg-[#0d0d0d]"
                          : "bg-[#0d0d0d] hover:bg-[#1a1a2e] cursor-pointer"
                    }
                  `}
                  style={{
                    border: isSelected
                      ? `3px solid ${char.color}`
                      : "3px solid #222",
                    boxShadow: isSelected
                      ? `0 0 12px ${char.color}60, 3px 3px 0 #111`
                      : "3px 3px 0 #111",
                    transition: "all 0.15s ease-out",
                  }}
                >
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 relative overflow-hidden mb-1"
                    style={{ imageRendering: "pixelated" }}
                  >
                    <Image
                      src={char.image}
                      alt={char.name}
                      width={56}
                      height={56}
                      className="w-full h-full object-contain"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                  <span className="text-[8px]" style={{ color: char.color }}>
                    {char.name}
                  </span>
                  {isTaken && (
                    <span className="text-[7px] text-red-500 mt-0.5">
                      TAKEN
                    </span>
                  )}
                  {isSelected && (
                    <span className="text-[7px] text-green-400 mt-0.5 blink">
                      &gt; SELECT &lt;
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="pixel-border-red p-2 mb-4">
              <p className="neon-red text-[9px]">{error}</p>
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={!selectedCharacter || !connected || isJoining}
            className="retro-btn retro-btn-amber"
          >
            {isJoining
              ? ">> JOINING..."
              : selectedCharacter
                ? `>> JOIN AS ${CHARACTER_MAP[selectedCharacter]?.name}`
                : ">> SELECT A CHARACTER"}
          </button>

          {/* Players already in */}
          {playersWithCharacters.length > 0 && (
            <div className="mt-6 panel-slide-in">
              <p className="text-green-700 text-[8px] text-center mb-2">
                PLAYERS IN LOBBY:
              </p>
              <div className="flex gap-3 justify-center">
                {playersWithCharacters.map((p) => {
                  const c = CHARACTER_MAP[p.characterId!];
                  return (
                    <div key={p.address} className="flex flex-col items-center">
                      <div
                        className="w-8 h-8 overflow-hidden"
                        style={{
                          border: `2px solid ${c?.color}`,
                          imageRendering: "pixelated",
                          boxShadow: `0 0 6px ${c?.color}30`,
                        }}
                      >
                        <Image
                          src={c?.image || "/charactres/bull.png"}
                          alt={c?.name || ""}
                          width={32}
                          height={32}
                          className="w-full h-full object-contain"
                          style={{ imageRendering: "pixelated" }}
                        />
                      </div>
                      <span
                        className="text-[7px] mt-0.5"
                        style={{ color: c?.color }}
                      >
                        {c?.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // ██ LOBBY STATE ██████████████████████████████████████████████
  // ════════════════════════════════════════════════════════════
  if (gameState === "lobby") {
    return (
      <div
        className="bg-[#0a0a0a] grid-bg relative overflow-hidden flex flex-col"
        style={{ height: "100%" }}
      >
        <StarField />

        {/* HUD - Top Bar */}
        <div
          className="relative z-30 flex items-center justify-between px-3 py-2 flex-shrink-0 hud-bar"
          style={{ borderBottom: "2px solid #1a3a1a" }}
        >
          <span className="text-green-700 text-[8px]">
            LIAR&apos;S BAR // LOBBY
          </span>
          <div className="flex items-center gap-3">
            {isPlayerInTable && tableData?.isOpen && (
              <button
                onClick={handleLeaveTable}
                disabled={isQuitting}
                className="text-red-500 text-[8px] hover:text-red-300 transition"
              >
                {isQuitting ? "LEAVING..." : "[X] QUIT"}
              </button>
            )}
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto retro-scroll">
          <pre className="neon-green text-[8px] sm:text-[10px] mb-1 text-center">
            {`╔══════════════════════════════╗
║       WAITING ROOM           ║
╚══════════════════════════════╝`}
          </pre>

          {/* Player count + status */}
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-400 dot-pulse" />
            <span className="text-green-400 text-[10px]">
              {playersWithCharacters.length}/5 PLAYERS
            </span>
          </div>

          <button
            onClick={handleCopyTableId}
            className="text-green-800 text-[8px] mb-6 hover:text-green-500 transition flex items-center gap-1"
          >
            <span>
              TABLE: {tableId.slice(0, 8)}...{tableId.slice(-4)}
            </span>
            <span className={copied ? "neon-green" : "text-green-600"}>
              {copied ? "[COPIED!]" : "[COPY]"}
            </span>
          </button>

          {/* Player Cards */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {playersWithPositions.map((player, idx) => (
              <div
                key={player.address}
                className="lobby-player-card flex flex-col items-center p-3 bg-[#0d0d0d] relative pixel-fade-in"
                style={{
                  border: `3px solid ${player.color}`,
                  boxShadow: `0 0 10px ${player.color}30, 4px 4px 0 #111`,
                  minWidth: "90px",
                  animationDelay: `${idx * 0.1}s`,
                }}
              >
                {/* Tags */}
                {idx === 0 && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 player-tag bg-amber-500 text-black"
                    style={{ boxShadow: "0 0 6px #fbbf2440" }}
                  >
                    HOST
                  </div>
                )}
                {player.isCurrentPlayer && idx !== 0 && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 player-tag bg-green-500 text-black"
                    style={{ boxShadow: "0 0 6px #39ff1440" }}
                  >
                    YOU
                  </div>
                )}

                <div
                  className="w-12 h-12 sm:w-14 sm:h-14 overflow-hidden mb-2"
                  style={{
                    imageRendering: "pixelated",
                    border: `1px solid ${player.color}40`,
                  }}
                >
                  <Image
                    src={player.image}
                    alt={player.name}
                    width={56}
                    height={56}
                    className="w-full h-full object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
                <span
                  className="text-[9px] font-bold"
                  style={{ color: player.color }}
                >
                  {player.name}
                </span>
                <span className="text-green-900 text-[7px] mt-0.5">
                  {player.address.slice(0, 4)}..{player.address.slice(-4)}
                </span>
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({
              length: Math.max(0, 2 - playersWithPositions.length),
            }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex flex-col items-center justify-center p-3"
                style={{
                  border: "3px dashed #222",
                  minWidth: "90px",
                  minHeight: "100px",
                  opacity: 0.3,
                }}
              >
                <span className="text-green-900 text-[8px]">?</span>
                <span className="text-green-900 text-[7px] mt-1">EMPTY</span>
              </div>
            ))}
          </div>

          {/* Start / Waiting */}
          {isPlayerInTable && (
            <div className="text-center">
              {canStart ? (
                <button
                  onClick={() => startRound()}
                  disabled={isStarting}
                  className="retro-btn retro-btn-amber turn-pulse"
                >
                  {isStarting ? ">> STARTING..." : ">> START GAME"}
                </button>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-green-700 text-[10px] blink">
                    WAITING FOR PLAYERS...
                  </p>
                  <p className="text-green-900 text-[7px]">
                    SHARE TABLE ID TO INVITE FRIENDS
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Decorative */}
          <pre className="text-green-900 text-[7px] mt-8 text-center select-none">
            {`   ┌─────┐ ┌─────┐ ┌─────┐
   │░░░░░│ │░░░░░│ │░░░░░│
   │░░?░░│ │░░?░░│ │░░?░░│
   │░░░░░│ │░░░░░│ │░░░░░│
   └─────┘ └─────┘ └─────┘`}
          </pre>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // ██ GAME OVER STATE ██████████████████████████████████████████
  // ════════════════════════════════════════════════════════════
  if (gameState === "ended" || isOver) {
    const winner = playersWithPositions.find(
      (p) => !eliminatedPlayers.has(p.address),
    );
    return (
      <div
        className="bg-[#0a0a0a] grid-bg relative overflow-hidden flex flex-col items-center justify-center"
        style={{ height: "100%" }}
      >
        <StarField />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <pre className="neon-amber text-[10px] sm:text-[12px] text-center">
            {`╔══════════════════════════════╗
║        GAME  OVER            ║
╚══════════════════════════════╝`}
          </pre>

          {winner && (
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 overflow-hidden"
                style={{
                  border: `3px solid ${winner.color}`,
                  boxShadow: `0 0 20px ${winner.color}60`,
                  imageRendering: "pixelated",
                }}
              >
                <Image
                  src={winner.image}
                  alt={winner.name}
                  width={80}
                  height={80}
                  className="w-full h-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <span
                className="text-[12px] sm:text-[14px] font-bold blink"
                style={{ color: winner.color }}
              >
                {winner.isCurrentPlayer ? "YOU WIN!" : `${winner.name} WINS!`}
              </span>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            {canStart && (
              <button
                onClick={() => startRound()}
                disabled={isStarting}
                className="retro-btn retro-btn-cyan"
              >
                {isStarting ? ">> STARTING..." : ">> NEW GAME"}
              </button>
            )}
            <a href="/retro" className="retro-btn retro-btn-amber">
              {"<< BACK TO MENU"}
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // ██ PLAYING STATE ████████████████████████████████████████████
  // ════════════════════════════════════════════════════════════

  const myPlayer = playersWithPositions.find((p) => p.isCurrentPlayer);

  return (
    <div
      className="bg-[#0a0a0a] grid-bg relative overflow-hidden flex flex-col"
      style={{ height: "100%" }}
    >
      <StarField />

      {/* ═══ ROW 1: HUD Top Bar ═══════════════════════════════ */}
      <div
        className="relative z-40 flex items-center justify-between px-3 py-2 flex-shrink-0 hud-bar"
        style={{ borderBottom: "2px solid #1a3a1a" }}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-green-700 text-[8px]">LIAR&apos;S BAR</span>
          <span className="text-green-900 text-[6px]">|</span>
          <span className="text-green-900 text-[7px]">
            {playersWithCharacters.length}/5
          </span>
          {/* WebSocket Connection Status */}
          <span className="text-green-900 text-[6px]">|</span>
          <div className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-green-500 dot-pulse"
                  : connectionStatus === "reconnecting"
                    ? "bg-yellow-500 blink"
                    : "bg-red-500"
              }`}
            />
            <span
              className={`text-[6px] ${
                connectionStatus === "connected"
                  ? "text-green-600"
                  : connectionStatus === "reconnecting"
                    ? "text-yellow-500"
                    : "text-red-500"
              }`}
            >
              {connectionStatus === "connected"
                ? "WS"
                : connectionStatus === "reconnecting"
                  ? "RECONNECTING"
                  : "WS OFF"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {isMyTurn ? (
            <span className="neon-amber text-[8px] sm:text-[9px] blink tracking-wider whitespace-nowrap">
              !! YOUR TURN !!
            </span>
          ) : currentTurnPlayer ? (
            <span className="text-green-600 text-[7px] whitespace-nowrap">
              {(() => {
                const tp = playersWithPositions.find(
                  (p) => p.address === currentTurnPlayer,
                );
                return tp ? `${tp.name}'S TURN` : "WAITING...";
              })()}
            </span>
          ) : null}
        </div>
      </div>

      {/* ═══ ROW 2: Main Game Area ════════════════════════════ */}
      <div className="relative z-10 flex-1 flex min-h-0">
        {/* ── LEFT SIDEBAR ──────────────────────────────────── */}
        <div className="relative z-30 w-44 sm:w-52 flex-shrink-0 flex flex-col p-2 gap-2 min-h-0 overflow-y-auto overflow-x-hidden retro-scroll">
          {/* Table Card Info Panel */}
          {tableData && (
            <div
              className="bg-[#0a0a0aCC] p-2 sm:p-3 panel-slide-in"
              style={{ border: "2px solid #1a3a1a" }}
            >
              <p className="text-green-600 text-[7px] sm:text-[8px] mb-2">
                TABLE CARD:
              </p>
              <div className="flex items-start gap-3 mb-2">
                {/* ASCII Card Art */}
                <pre
                  className="text-[7px] sm:text-[8px] leading-tight select-none"
                  style={{
                    color: "#fbbf24",
                    textShadow: "0 0 6px #fbbf2440",
                  }}
                >
                  {getTableCardArt(tableData.tableCard).join("\n")}
                </pre>

                {/* Cards on table */}
                {tableData.cardsOnTable > 0 && (
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="text-green-700 text-[6px]">ON TABLE:</span>
                    <div className="flex gap-1 flex-wrap">
                      {Array.from({ length: tableData.cardsOnTable }).map(
                        (_, i) => (
                          <pre
                            key={i}
                            className="text-[5px] sm:text-[6px] leading-tight"
                            style={{ color: "#4a90d9" }}
                          >
{`┌───┐
│░░░│
│ ? │
│░░░│
└───┘`}
                          </pre>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Last claim */}
              {lastClaimBy &&
                (() => {
                  const claimPlayer = tableData.playerInfos.find(
                    (p) => p.address === lastClaimBy,
                  );
                  const character = claimPlayer?.characterId
                    ? CHARACTER_MAP[claimPlayer.characterId]
                    : null;
                  const cardName = TABLE_CARD_NAMES[tableData.tableCard] ?? "?";
                  const count = tableData.cardsOnTable;
                  return (
                    <div
                      className="flex items-center gap-1.5 flex-wrap mt-1 pt-1"
                      style={{ borderTop: "1px solid #1a3a1a" }}
                    >
                      {character && (
                        <div
                          className="w-5 h-5 overflow-hidden flex-shrink-0"
                          style={{
                            border: `1px solid ${character.color}`,
                            imageRendering: "pixelated",
                          }}
                        >
                          <Image
                            src={character.image}
                            alt={character.name}
                            width={20}
                            height={20}
                            className="w-full h-full object-contain"
                            style={{ imageRendering: "pixelated" }}
                          />
                        </div>
                      )}
                      <span className="text-[7px] sm:text-[8px]">
                        <span style={{ color: character?.color ?? "#888" }}>
                          {character?.name ?? "???"}
                        </span>
                        <span className="text-green-700"> SAID </span>
                        <span className="neon-amber">
                          {count} {cardName}
                          {count !== 1 ? "S" : ""}
                        </span>
                      </span>
                    </div>
                  );
                })()}

              {!lastClaimBy && tableData.cardsOnTable === 0 && (
                <span className="text-green-800 text-[7px] blink">
                  FIRST MOVE...
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── CENTER: Table + Players ────────────────────────── */}
        <div className="flex-1 relative min-w-0 min-h-0 overflow-hidden">
          {/* Table */}
          <div
            className="absolute inset-0 flex items-center justify-center"
          >
            <div
              className="retro-table-outer"
              style={{ width: "min(95%, 600px)", height: "min(85%, 400px)" }}
            >
              <div className="retro-table-shadow" />
              <div className="retro-table-wood">
                <div className="retro-table-bevel">
                  <div className="retro-table-trim" />
                  <div className="retro-table-felt">
                    <div className="retro-table-felt-texture" />
                    <div className="retro-table-betting-line" />
                    <div className="retro-table-glow" />
                    <div className="retro-table-emblem">
                      <div className="retro-table-emblem-diamond" />
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                      <span
                        className="text-[8px] sm:text-[10px] tracking-[4px]"
                        style={{
                          color: "#2d8b4a",
                          textShadow: "0 0 6px #2d8b4a30",
                        }}
                      >
                        LIAR&apos;S
                      </span>
                      <span
                        className="text-[6px] sm:text-[8px] tracking-[6px] mt-0.5"
                        style={{ color: "#2d8b4a80" }}
                      >
                        BAR
                      </span>
                    </div>
                    <div className="retro-table-vignette" />
                  </div>
                </div>
                <div
                  className="retro-table-chip"
                  style={{ top: "14%", left: "14%" }}
                />
                <div
                  className="retro-table-chip"
                  style={{ top: "14%", right: "14%" }}
                />
                <div
                  className="retro-table-chip"
                  style={{ bottom: "14%", left: "14%" }}
                />
                <div
                  className="retro-table-chip"
                  style={{ bottom: "14%", right: "14%" }}
                />
              </div>
            </div>

            {/* Player Seats */}
            {playersWithPositions
              .filter((p) => !p.isCurrentPlayer)
              .map((player) => {
                const isTurnPlayer = currentTurnPlayer === player.address;
                const isEliminated = eliminatedPlayers.has(player.address);
                const isAnimTarget =
                  activeAnimation?.player === player.address;
                return (
                  <div
                    key={player.address}
                    className={`retro-seat ${isTurnPlayer ? "retro-seat-active" : ""} ${isEliminated ? "retro-seat-eliminated" : ""}`}
                    style={{
                      top: player.top,
                      left: player.left,
                      opacity: isEliminated ? 0.3 : 1,
                      filter: isEliminated ? "grayscale(0.8)" : "none",
                      transition: "opacity 0.5s, filter 0.5s",
                      pointerEvents: isEliminated ? "none" : undefined,
                    }}
                  >
                    {isTurnPlayer && !isEliminated && (
                      <span className="neon-amber text-[6px] mb-1 blink tracking-wider">
                        TURN
                      </span>
                    )}
                    {isEliminated && (
                      <span className="neon-red text-[6px] mb-1 tracking-wider">
                        OUT
                      </span>
                    )}
                    <div className="relative">
                      <div className="retro-seat-ring" />
                      {/* Liar called animation ring */}
                      {isAnimTarget && activeAnimation?.type === "liar-called" && (
                        <div className="anim-liar-ring" />
                      )}
                      {/* Empty bullet animation */}
                      {isAnimTarget && activeAnimation?.type === "empty-bullet" && (
                        <div className="anim-bullet-flash" />
                      )}
                      {/* Eliminated animation */}
                      {isAnimTarget && activeAnimation?.type === "player-eliminated" && (
                        <div className="anim-eliminated-x" />
                      )}
                      <div
                        className={`w-10 h-10 sm:w-12 sm:h-12 overflow-hidden ${isTurnPlayer && !isEliminated ? "turn-pulse" : ""}`}
                        style={{
                          border: `3px solid ${isEliminated ? "#444" : player.color}`,
                          boxShadow: isTurnPlayer && !isEliminated
                            ? `0 0 12px ${player.color}80, 3px 3px 0 #111`
                            : `3px 3px 0 #111`,
                          imageRendering: "pixelated",
                          background: "#0a0a0a",
                          transition: "box-shadow 0.3s, border-color 0.5s",
                        }}
                      >
                        <Image
                          src={player.image}
                          alt={player.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-contain"
                          style={{ imageRendering: "pixelated" }}
                        />
                      </div>
                    </div>
                    <div
                      className="mt-1 px-2 py-0.5 text-[7px] sm:text-[8px] text-center whitespace-nowrap"
                      style={{
                        background: "#0d0d0dEE",
                        color: isEliminated ? "#555" : player.color,
                        border: `2px solid ${isEliminated ? "#33333350" : player.color + "50"}`,
                        boxShadow: `0 0 6px ${isEliminated ? "#00000015" : player.color + "15"}, 2px 2px 0 #0a0a0a`,
                        textDecoration: isEliminated ? "line-through" : "none",
                      }}
                    >
                      {player.name}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Liar Called Banner */}
          {liarCaller && (
            <div
              className="absolute z-30 flex justify-center inset-x-0"
              style={{ top: "8%" }}
            >
              <div
                className="px-4 py-2 bg-[#0a0a0aEE]"
                style={{
                  border: "2px solid #ef4444",
                  boxShadow: "0 0 16px #ef444460",
                }}
              >
                <span className="neon-red text-[9px] sm:text-[10px]">
                  {(() => {
                    const callerPlayer = playersWithPositions.find(
                      (p) => p.address === liarCaller,
                    );
                    return callerPlayer
                      ? `${callerPlayer.name} CALLED LIAR!`
                      : "LIAR CALLED!";
                  })()}
                </span>
              </div>
            </div>
          )}

          {/* Shuffle Button */}
          {shouldShowShuffleButton && (
            <div
              className="absolute z-30 flex justify-center inset-x-0"
              style={{ bottom: "22%" }}
            >
              <button
                onClick={shuffleCards}
                disabled={isShuffling}
                className="retro-btn retro-btn-cyan text-[9px] px-4 py-2"
              >
                {isShuffling ? "SHUFFLING..." : ">> SHUFFLE"}
              </button>
            </div>
          )}

          {/* ── Card Placed Animation Overlay ───────────────── */}
          {activeAnimation?.type === "card-placed" && (
            <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
              <div className="anim-card-placed-flash">
                <span className="neon-cyan text-[10px]">CARD PLACED</span>
              </div>
            </div>
          )}

          {/* ── Liar Called Animation Overlay ────────────────── */}
          {activeAnimation?.type === "liar-called" && (
            <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
              <div className="anim-liar-overlay">
                <pre className="neon-red text-[12px] sm:text-[16px] text-center">
                  {`!! LIAR !!`}
                </pre>
              </div>
            </div>
          )}

          {/* ── Empty Bullet Animation Overlay ──────────────── */}
          {activeAnimation?.type === "empty-bullet" && (
            <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
              <div className="anim-roulette-overlay">
                <pre className="neon-amber text-[10px] sm:text-[14px] text-center">
                  {`*CLICK*\nEMPTY CHAMBER`}
                </pre>
              </div>
            </div>
          )}

          {/* ── Player Eliminated Animation Overlay ─────────── */}
          {activeAnimation?.type === "player-eliminated" && (
            <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
              <div className="anim-eliminated-overlay">
                <pre className="neon-red text-[10px] sm:text-[14px] text-center">
                  {`ELIMINATED`}
                </pre>
              </div>
            </div>
          )}

          {/* ── Round Started Animation Overlay ─────────────── */}
          {activeAnimation?.type === "round-started" && (
            <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
              <div className="anim-round-start">
                <pre className="neon-green text-[12px] sm:text-[16px] text-center">
                  {`ROUND START`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* ── Wallet Disconnect Overlay ────────────────────── */}
        {!connected && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0a]/90">
            <pre className="neon-red text-[9px] sm:text-[10px] text-center mb-3">
              {`╔══════════════════════════════╗
║    WALLET  DISCONNECTED      ║
╚══════════════════════════════╝`}
            </pre>
            <p className="neon-amber text-[9px] blink tracking-widest">
              RECONNECT TO CONTINUE
            </p>
          </div>
        )}

        {/* ── RIGHT SIDEBAR: Event Log ─────────────────────── */}
        <div className="relative z-30 w-44 sm:w-52 flex-shrink-0 flex flex-col p-2 gap-2 min-h-0">
          <div
            className="bg-[#0a0a0aCC] flex-1 flex flex-col min-h-0 panel-slide-in"
            style={{ border: "2px solid #1a3a1a" }}
          >
            <div
              className="px-2 py-1.5 flex items-center justify-between"
              style={{ borderBottom: "1px solid #1a3a1a" }}
            >
              <span className="text-green-600 text-[7px]">EVENT LOG</span>
              <span className="text-green-900 text-[6px]">
                {wsEventLog.length}
              </span>
            </div>
            <div
              ref={eventLogRef}
              className="flex-1 overflow-y-auto retro-scroll px-1.5 py-1"
            >
              {wsEventLog.length === 0 && (
                <p className="text-green-900 text-[7px] text-center py-2">
                  WAITING FOR EVENTS...
                </p>
              )}
              {wsEventLog.map((entry, i) => (
                <div
                  key={`${entry.timestamp}-${i}`}
                  className="py-0.5 panel-slide-in"
                  style={{
                    borderBottom: "1px solid #0a1a0a",
                    animationDelay: `${i * 0.02}s`,
                  }}
                >
                  <span
                    className="text-[6px] block"
                    style={{
                      color:
                        entry.type === "liarCalled"
                          ? "#ef4444"
                          : entry.type === "playerEleminated"
                            ? "#ef4444"
                            : entry.type === "emptyBulletFired"
                              ? "#fbbf24"
                              : entry.type === "roundStarted"
                                ? "#39ff14"
                                : entry.type === "cardPlaced"
                                  ? "#22d3ee"
                                  : "#4ade80",
                    }}
                  >
                    [{new Date(entry.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className="text-green-400 text-[7px]">
                    {entry.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ ROW 3: Hand + Actions ════════════════════════════ */}
      <div
        className="relative z-30 flex-shrink-0 flex flex-col items-center gap-2 pb-1 pt-2"
        style={{
          borderTop: `2px solid ${isMyTurn ? "#fbbf2440" : "#1a3a1a"}`,
          background: "#060606EE",
          maxHeight: "40%",
          transition: "border-color 0.3s",
        }}
      >
        {/* Cards */}
        {myEncryptedCards.length > 0 && (
          <div
            className="flex items-end gap-1.5 sm:gap-2 overflow-x-auto overflow-y-visible max-w-full px-3 pb-1 retro-scroll"
            style={{ scrollbarWidth: "thin" }}
          >
            {myEncryptedCards.map((_, index) => {
              const card = myCards[index];
              const isSelected = selectedCardIndices.includes(index);

              if (card) {
                const suitColor = SUIT_COLORS[card.shape];
                const suitSymbol = SUIT_SYMBOLS[card.shape];
                const valueLabel = VALUE_LABELS[card.value] ?? "?";
                return (
                  <button
                    key={index}
                    onClick={() => handleCardClick(index)}
                    className={`retro-card-face pixel-fade-in ${isSelected ? "selected" : ""}`}
                    style={{
                      transform: isSelected ? "translateY(-8px)" : undefined,
                      borderColor: isSelected ? "#fbbf24" : "#444",
                      animationDelay: `${index * 0.05}s`,
                    }}
                  >
                    <span
                      className="absolute top-1 left-1.5 text-[8px] font-bold"
                      style={{ color: suitColor }}
                    >
                      {valueLabel}
                    </span>
                    <span className="text-xl" style={{ color: suitColor }}>
                      {suitSymbol}
                    </span>
                    <span
                      className="absolute bottom-1 right-1.5 text-[8px] font-bold rotate-180"
                      style={{ color: suitColor }}
                    >
                      {valueLabel}
                    </span>
                  </button>
                );
              }

              const isDecrypting =
                index === myCards.length && isDecryptingCards;
              return (
                <div
                  key={index}
                  className="retro-card-back"
                  style={{
                    opacity: isDecrypting ? undefined : 0.8,
                    animation: isDecrypting
                      ? "pulse 1s ease-in-out infinite"
                      : undefined,
                  }}
                >
                  <span className="text-blue-300 text-[10px] opacity-40">
                    ?
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {isDecryptingCards && (
          <p className="text-cyan-400 text-[8px] blink">DECRYPTING CARDS...</p>
        )}

        {/* Action Buttons */}
        {gameState === "playing" && myCards.length > 0 && (
          pendingAction ? (
            <div className="flex flex-col items-center gap-1 pixel-fade-in">
              <p className="neon-amber text-[9px] text-center">
                {pendingAction === "liar"
                  ? "CALL LIAR? THIS CANNOT BE UNDONE."
                  : `CLAIM ${selectedCardIndices.length} ${TABLE_CARD_NAMES[tableData?.tableCard ?? 0] ?? "CARD"}${selectedCardIndices.length !== 1 ? "S" : ""}? CONFIRM?`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    setPendingAction(null);
                    if (pendingAction === "liar") await callLiar();
                    else await handlePlaceCards();
                  }}
                  className="retro-btn retro-btn-amber text-[9px] px-4 py-1"
                >
                  YES
                </button>
                <button
                  onClick={() => setPendingAction(null)}
                  className="retro-btn retro-btn-red text-[9px] px-4 py-1"
                >
                  NO
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPendingAction("liar")}
                disabled={!isMyTurn || !tableData || tableData.cardsOnTable === 0 || isCallingLiar || isPlacingCards}
                className="retro-btn retro-btn-red text-[9px] px-4 py-2"
              >
                {isCallingLiar ? "CALLING..." : "!! LIAR !!"}
              </button>
              <button
                onClick={() => selectedCardIndices.length > 0 && setPendingAction("place")}
                disabled={!isMyTurn || selectedCardIndices.length === 0 || isPlacingCards || isCallingLiar}
                className={`retro-btn retro-btn-amber text-[9px] px-4 py-2 ${isMyTurn && selectedCardIndices.length > 0 && !isPlacingCards ? "turn-pulse" : ""}`}
              >
                {isPlacingCards
                  ? "PLACING..."
                  : `PLAY${selectedCardIndices.length > 0 ? ` (${selectedCardIndices.length})` : ""}`}
              </button>
            </div>
          )
        )}

        {/* Status line */}
        <div
          className="w-full flex items-center justify-between px-3 py-0.5"
          style={{ borderTop: "1px solid #1a3a1a" }}
        >
          <span className="text-green-900 text-[6px] sm:text-[7px]">
            TABLE: {tableId.slice(0, 8)}...
          </span>
          <div className="flex items-center gap-3">
            {/* Wallet status */}
            <div className="flex items-center gap-1">
              <span
                className={`w-1 h-1 rounded-full ${connected ? "bg-green-500 dot-pulse" : "bg-red-500"}`}
              />
              <span className="text-green-900 text-[6px] sm:text-[7px]">
                {connected ? "WALLET" : "NO WALLET"}
              </span>
            </div>
            {/* WebSocket status */}
            <div className="flex items-center gap-1">
              <span
                className={`w-1 h-1 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-green-500 dot-pulse"
                    : connectionStatus === "reconnecting"
                      ? "bg-yellow-500 blink"
                      : "bg-red-500"
                }`}
              />
              <span
                className={`text-[6px] sm:text-[7px] ${
                  connectionStatus === "connected"
                    ? "text-green-900"
                    : connectionStatus === "reconnecting"
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {connectionStatus === "connected"
                  ? "WS LIVE"
                  : connectionStatus === "reconnecting"
                    ? "RECONNECTING..."
                    : "WS DOWN"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Player Card - fixed bottom left */}
      {connected && publicKey && myPlayer && (
        <div
          className="fixed z-50 left-3 p-2 flex items-center gap-2 panel-slide-in"
          style={{
            bottom: "5%",
            background: "#0a0a0aEE",
            border: `2px solid ${myPlayer.color}`,
            boxShadow: isMyTurn
              ? `0 0 16px ${myPlayer.color}50, 3px 3px 0 #111`
              : `0 0 10px ${myPlayer.color}30, 3px 3px 0 #111`,
            transition: "box-shadow 0.3s",
          }}
        >
          <div
            className="w-10 h-10 sm:w-12 sm:h-12 overflow-hidden flex-shrink-0"
            style={{
              border: `2px solid ${myPlayer.color}`,
              boxShadow: `0 0 8px ${myPlayer.color}50`,
              imageRendering: "pixelated",
              background: "#0a0a0a",
            }}
          >
            <Image
              src={myPlayer.image}
              alt={myPlayer.name}
              width={48}
              height={48}
              className="w-full h-full object-contain"
              style={{ imageRendering: "pixelated" }}
            />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className="text-[8px] sm:text-[9px] font-bold truncate"
              style={{ color: myPlayer.color }}
            >
              {myPlayer.name}
            </span>
            <span className="text-green-600 text-[6px] sm:text-[7px] truncate">
              {publicKey.toString().slice(0, 6)}...
              {publicKey.toString().slice(-4)}
            </span>
            <span className="text-cyan-400 text-[7px] sm:text-[8px]">
              {balance !== null ? balance.toFixed(3) : "..."} SOL
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

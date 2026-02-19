"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PokerTable } from "@/components/PokerTable";
import { CharacterSelect } from "@/components/CharacterSelect";
import { useTable } from "@/lib/solana/useTable";

const CHARACTER_MAP: Record<string, { name: string; image: string; color: string }> = {
  bull: { name: "Bull", image: "/charactres/bull.png", color: "from-red-500 to-rose-600" },
  cat: { name: "Cat", image: "/charactres/cat.png", color: "from-violet-500 to-purple-600" },
  dog: { name: "Dog", image: "/charactres/dog.png", color: "from-amber-400 to-orange-500" },
  lion: { name: "Lion", image: "/charactres/lions.png", color: "from-yellow-400 to-amber-500" },
  pig: { name: "Pig", image: "/charactres/pig.png", color: "from-pink-400 to-rose-500" },
  rabbit: { name: "Rabbit", image: "/charactres/rabbit.png", color: "from-slate-300 to-slate-500" },
  wolf: { name: "Wolf", image: "/charactres/wolf.png", color: "from-slate-400 to-slate-600" },
};

function getPlayerPositions(playerCount: number, currentPlayerIndex: number) {
  const centerTop = 56.5;
  const centerLeft = 50;
  const radiusY = 13.5;
  const radiusX = 30;

  const positions: { top: number; left: number }[] = [];
  const angleStep = (2 * Math.PI) / playerCount;
  const startAngle = (3 * Math.PI) / 2;

  for (let i = 0; i < playerCount; i++) {
    const posIndex = (i - currentPlayerIndex + playerCount) % playerCount;
    const angle = startAngle + posIndex * angleStep;
    const top = centerTop - radiusY * Math.sin(angle);
    const left = centerLeft + radiusX * Math.cos(angle);
    positions.push({ top: Math.round(top), left: Math.round(left) });
  }

  return positions;
}

export default function TablePage() {
  const params = useParams();
  const router = useRouter();
  const tableId = params.tableId as string;
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [selectedCardIndices, setSelectedCardIndices] = useState<number[]>([]);

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
    // Shuffle
    shouldShowShuffleButton,
    shuffleCards,
    isShuffling,
    // Cards
    myCards,
    myEncryptedCards,
    decryptMyCards,
    isDecryptingCards,
    decryptFailed,
  } = useTable(tableId);

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!publicKey) {
        setBalance(null);
        return;
      }
      try {
        const bal = await connection.getBalance(publicKey);
        setBalance(bal / LAMPORTS_PER_SOL);
      } catch (err) {
        console.error("Error fetching balance:", err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  const handleLeaveTable = async () => {
    const success = await quitTable();
    if (success) {
      router.push("/");
    }
  };

  const currentPlayerIndex = tableData?.players.findIndex(
    (p) => p === publicKey?.toString()
  ) ?? 0;

  const playersWithCharacters = tableData?.playerInfos.filter(p => p.characterId) ?? [];
  const playerCount = playersWithCharacters.length;
  const positions = getPlayerPositions(Math.max(playerCount, 1), currentPlayerIndex >= 0 ? currentPlayerIndex : 0);

  const playersWithPositions = playersWithCharacters.map((playerInfo, index) => {
    const character = playerInfo.characterId ? CHARACTER_MAP[playerInfo.characterId] : null;
    const position = positions[index] || { top: 50, left: 50 };

    return {
      address: playerInfo.address,
      characterId: playerInfo.characterId,
      name: character?.name || "Unknown",
      image: character?.image || "/charactres/bull.png",
      color: character?.color || "from-gray-500 to-gray-700",
      top: position.top,
      left: position.left,
      isCurrentPlayer: playerInfo.address === publicKey?.toString(),
    };
  });

  const handleJoin = async () => {
    if (!selectedCharacter) return;
    const success = await joinTable(selectedCharacter);
    if (success) setSelectedCharacter(null);
  };

  // Auto-decrypt cards when game is playing and we have encrypted cards (once only)
  useEffect(() => {
    if (gameState === "playing" && myEncryptedCards.length > 0 && myCards.length === 0 && !isDecryptingCards && !decryptFailed) {
      decryptMyCards();
    }
  }, [gameState, myEncryptedCards.length, myCards.length, isDecryptingCards, decryptFailed, decryptMyCards]);

  // Toggle card selection
  const handleCardClick = (index: number) => {
    setSelectedCardIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      // Limit to 3 cards selected at a time
      if (prev.length >= 3) {
        return [...prev.slice(1), index];
      }
      return [...prev, index];
    });
  };

  const handleStartGame = async () => {
    await startRound();
  };

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // Error
  if (error && !tableData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <span className="text-red-500 text-2xl">✕</span>
          </div>
          <h2 className="text-white text-xl font-semibold mb-2">Table Not Found</h2>
          <p className="text-white/50 mb-6">{error}</p>
          <a href="/" className="px-6 py-3 bg-white text-black font-medium rounded-full hover:bg-white/90 transition">
            Go Home
          </a>
        </div>
      </div>
    );
  }

  // Character selection
  if (!isPlayerInTable && tableData?.isOpen) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-500/20 rounded-full blur-[100px]" />

        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-2xl">
            {/* Header */}
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold text-white mb-2">Join Table</h1>
              <button
                onClick={handleCopyTableId}
                className="inline-flex items-center gap-2 text-white/40 hover:text-white/60 transition text-sm"
              >
                <span className="font-mono">{tableId.slice(0, 12)}...</span>
                <span>{copied ? "✓" : "⧉"}</span>
              </button>
            </div>

            {/* Wallet warning */}
            {!connected && (
              <div className="mb-6 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                <p className="text-yellow-500 text-sm">Connect wallet to join</p>
              </div>
            )}

            {/* Character select card */}
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8">
              <p className="text-white/60 text-sm mb-6 text-center">Choose your character</p>

              <CharacterSelect
                selectedCharacter={selectedCharacter}
                takenCharacters={takenCharacters}
                onSelect={setSelectedCharacter}
                disabled={!connected || isJoining}
              />

              {error && (
                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={!selectedCharacter || !connected || isJoining}
                className="mt-8 w-full py-4 bg-white text-black font-semibold rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/90 transition flex items-center justify-center gap-3"
              >
                {isJoining ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>Join{selectedCharacter && ` as ${CHARACTER_MAP[selectedCharacter]?.name}`}</>
                )}
              </button>
            </div>

            {/* Players waiting */}
            {playersWithCharacters.length > 0 && (
              <div className="mt-8 flex justify-center gap-3">
                {playersWithCharacters.map((player) => {
                  const char = CHARACTER_MAP[player.characterId!];
                  return (
                    <div key={player.address} className="group">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${char?.color} p-0.5 transition group-hover:scale-110`}>
                        <div className="w-full h-full rounded-[10px] bg-black/50 overflow-hidden">
                          <Image
                            src={char?.image || "/charactres/bull.png"}
                            alt={char?.name || ""}
                            width={48}
                            height={48}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main game view
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Top Right Header - Account Info */}
      {connected && publicKey && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
          {/* Balance */}
          <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 px-4 py-2 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">◎</span>
            </div>
            <span className="text-white font-medium">
              {balance !== null ? balance.toFixed(3) : "..."} SOL
            </span>
          </div>

          {/* Account */}
          <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 px-4 py-2">
            <span className="text-white/60 font-mono text-sm">
              {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
            </span>
          </div>

          {/* Leave Button */}
          {isPlayerInTable && tableData?.isOpen && (
            <button
              onClick={handleLeaveTable}
              disabled={isQuitting}
              className="bg-red-500/10 hover:bg-red-500/20 backdrop-blur-xl rounded-xl border border-red-500/30 px-4 py-2 text-red-400 font-medium transition flex items-center gap-2 disabled:opacity-50"
            >
              {isQuitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-red-400/20 border-t-red-400 rounded-full animate-spin" />
                  Leaving...
                </>
              ) : (
                <>
                  <span>✕</span>
                  Leave
                </>
              )}
            </button>
          )}
        </div>
      )}

      {gameState === "lobby" ? (
        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-4xl">
            {/* Header */}
            <div className="text-center mb-12">
              <p className="text-white/40 text-sm uppercase tracking-widest mb-3">Liar&apos;s Bar</p>
              <h1 className="text-5xl font-bold text-white mb-4">Waiting Room</h1>
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-white/60">{playersWithCharacters.length}/5 players</span>
                </div>
                <span className="text-white/20">•</span>
                <button
                  onClick={handleCopyTableId}
                  className="text-white/40 hover:text-white/60 transition text-sm font-mono flex items-center gap-2"
                >
                  {tableId.slice(0, 8)}...{tableId.slice(-4)}
                  <span className="text-xs">{copied ? "✓" : "⧉"}</span>
                </button>
              </div>
            </div>

            {/* Player cards */}
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              {playersWithPositions.map((player, idx) => (
                <div
                  key={player.address}
                  className={`relative bg-white/5 backdrop-blur rounded-2xl p-6 border transition-all hover:bg-white/10 ${
                    player.isCurrentPlayer ? "border-white/30 ring-1 ring-white/20" : "border-white/10"
                  }`}
                >
                  {idx === 0 && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-500 text-black text-[10px] font-bold uppercase rounded">
                      Host
                    </div>
                  )}
                  {player.isCurrentPlayer && idx !== 0 && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-white text-black text-[10px] font-bold uppercase rounded">
                      You
                    </div>
                  )}

                  <div className="flex flex-col items-center">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${player.color} p-0.5 mb-4`}>
                      <div className="w-full h-full rounded-[14px] bg-black/40 overflow-hidden">
                        <Image
                          src={player.image}
                          alt={player.name}
                          width={64}
                          height={64}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    <p className="text-white font-medium">{player.name}</p>
                    <p className="text-white/30 text-xs font-mono mt-1">
                      {player.address.slice(0, 4)}...{player.address.slice(-4)}
                    </p>
                  </div>
                </div>
              ))}

            </div>

            {/* Action */}
            {isPlayerInTable && (
              <div className="flex justify-center">
                {canStart ? (
                  <button
                    onClick={handleStartGame}
                    disabled={isStarting}
                    className="px-12 py-4 bg-white text-black font-semibold rounded-full hover:bg-white/90 transition disabled:opacity-50 flex items-center gap-3"
                  >
                    {isStarting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <span>▶</span>
                        Start Game
                      </>
                    )}
                  </button>
                ) : (
                  <div className="text-center">
                    <p className="text-white/40">Need at least 2 players to start</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Active game */
        <div className="relative z-10 h-screen flex items-center justify-center" style={{ perspective: "1000px" }}>
          <div className="w-full h-[60%] mb-8 self-end" style={{ transform: "rotateX(65deg)" }}>
            <PokerTable />
          </div>

          {/* Table Card — top left */}
          {tableData && gameState === "playing" && (
            <div className="absolute top-4 left-4 z-30">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-3 flex items-center gap-3">
                <div className="w-12 h-18 rounded-lg border-2 border-white/20 bg-white/10 flex flex-col items-center justify-center px-1 py-2">
                  <span className="text-white font-bold text-sm">
                    {["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][tableData.tableCard] ?? "?"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/40 text-[10px] uppercase tracking-wider">Table Card</span>
                  <span className="text-white font-semibold text-sm">
                    {["Ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King"][tableData.tableCard] ?? "Unknown"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Players */}
          {playersWithPositions.map((player) => (
            <div
              key={player.address}
              className="absolute z-20"
              style={{ top: `${player.top}%`, left: `${player.left}%` }}
            >
              <div className="flex flex-col items-center gap-2">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${player.color} p-0.5 ${player.isCurrentPlayer ? "ring-2 ring-white" : ""}`}>
                  <div className="w-full h-full rounded-[10px] bg-black/50 overflow-hidden">
                    <Image
                      src={player.image}
                      alt={player.name}
                      width={56}
                      height={56}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
                <span className="px-2 py-1 bg-black/60 backdrop-blur rounded-full text-white text-xs font-medium">
                  {player.name}
                </span>
              </div>
            </div>
          ))}

          {/* Shuffle Button - Only shown to the player whose turn it is to shuffle */}
          {shouldShowShuffleButton && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30">
              <button
                onClick={shuffleCards}
                disabled={isShuffling}
                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-2xl hover:from-purple-600 hover:to-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-lg shadow-purple-500/25"
              >
                {isShuffling ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Shuffling...
                  </>
                ) : (
                  <>
                    <span className="text-xl">🎴</span>
                    Shuffle Cards
                  </>
                )}
              </button>
            </div>
          )}

          {/* Player's Cards */}
          {myEncryptedCards.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-end gap-3">
              {myEncryptedCards.map((_, index) => {
                const card = myCards[index]; // undefined if not yet decrypted
                const suitSymbols = ["♠", "♥", "♦", "♣"];
                const suitColors = ["text-white", "text-red-500", "text-red-500", "text-white"];
                const valueLabels = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
                const isSelected = selectedCardIndices.includes(index);

                if (card) {
                  // Decrypted — show face
                  return (
                    <button
                      key={index}
                      onClick={() => handleCardClick(index)}
                      className={`relative w-16 h-24 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer hover:scale-105 animate-[flipIn_0.4s_ease-out] ${
                        isSelected
                          ? "border-yellow-400 bg-white/20 -translate-y-4 shadow-lg shadow-yellow-400/20"
                          : "border-white/20 bg-white/10 backdrop-blur-xl hover:border-white/40"
                      }`}
                    >
                      <span className={`text-lg font-bold ${suitColors[card.shape]}`}>
                        {valueLabels[card.value] ?? card.value}
                      </span>
                      <span className={`text-xl ${suitColors[card.shape]}`}>
                        {suitSymbols[card.shape]}
                      </span>
                    </button>
                  );
                }

                // Not yet decrypted — show card back
                const isNextToDecrypt = index === myCards.length && isDecryptingCards;
                return (
                  <div
                    key={index}
                    className={`w-16 h-24 rounded-xl border-2 border-white/10 bg-gradient-to-br from-indigo-900/60 to-purple-900/60 backdrop-blur-xl flex items-center justify-center transition-all duration-300 ${
                      isNextToDecrypt ? "animate-pulse border-purple-400/50" : ""
                    }`}
                  >
                    <div className="w-10 h-16 rounded-md border border-white/10 bg-gradient-to-br from-purple-800/40 to-indigo-800/40 flex items-center justify-center">
                      <span className="text-white/15 text-lg">♠</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected cards count */}
          {selectedCardIndices.length > 0 && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30">
              <div className="px-4 py-2 bg-yellow-500/10 backdrop-blur-xl rounded-full border border-yellow-500/30">
                <span className="text-yellow-400 text-sm font-medium">
                  {selectedCardIndices.length} card{selectedCardIndices.length > 1 ? "s" : ""} selected
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

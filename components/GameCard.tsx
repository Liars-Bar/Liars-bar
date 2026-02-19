"use client";

import { DecryptedCard } from "@/lib/solana/useTable";

// Card suits with symbols and colors
const SUITS = [
  { symbol: "♠", name: "Spades", color: "text-slate-900" },
  { symbol: "♥", name: "Hearts", color: "text-red-500" },
  { symbol: "♦", name: "Diamonds", color: "text-red-500" },
  { symbol: "♣", name: "Clubs", color: "text-slate-900" },
];

// Card values
const VALUES = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

interface GameCardProps {
  card: DecryptedCard;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
}

export function GameCard({ card, selected, onClick, size = "md" }: GameCardProps) {
  const suit = SUITS[card.shape] || SUITS[0];
  const value = VALUES[card.value] || "?";

  const sizeClasses = {
    sm: "w-12 h-16 text-xs",
    md: "w-16 h-24 text-sm",
    lg: "w-20 h-28 text-base",
  };

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`
        ${sizeClasses[size]}
        relative bg-white rounded-lg shadow-lg
        border-2 transition-all duration-200
        ${selected ? "border-amber-400 ring-2 ring-amber-400/50 -translate-y-2" : "border-gray-200"}
        ${onClick ? "hover:-translate-y-1 hover:shadow-xl cursor-pointer" : "cursor-default"}
        flex flex-col items-center justify-between p-1.5
      `}
    >
      {/* Top left corner */}
      <div className={`absolute top-1 left-1.5 flex flex-col items-center leading-none ${suit.color}`}>
        <span className="font-bold">{value}</span>
        <span className="text-[0.7em]">{suit.symbol}</span>
      </div>

      {/* Center suit */}
      <div className={`flex-1 flex items-center justify-center ${suit.color}`}>
        <span className={size === "lg" ? "text-3xl" : size === "md" ? "text-2xl" : "text-xl"}>
          {suit.symbol}
        </span>
      </div>

      {/* Bottom right corner (rotated) */}
      <div className={`absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180 ${suit.color}`}>
        <span className="font-bold">{value}</span>
        <span className="text-[0.7em]">{suit.symbol}</span>
      </div>
    </button>
  );
}

// Card back component for hidden cards
export function CardBack({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-12 h-16",
    md: "w-16 h-24",
    lg: "w-20 h-28",
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-lg shadow-lg
        bg-gradient-to-br from-blue-600 to-blue-800
        border-2 border-blue-400
        flex items-center justify-center
        relative overflow-hidden
      `}
    >
      {/* Pattern */}
      <div className="absolute inset-2 border-2 border-blue-300/30 rounded" />
      <div className="absolute inset-3 border border-blue-300/20 rounded" />
      <span className="text-blue-200 text-2xl font-bold opacity-30">?</span>
    </div>
  );
}

// Hand of cards component
interface PlayerHandProps {
  cards: DecryptedCard[];
  selectedIndices?: number[];
  onCardClick?: (index: number) => void;
  isLoading?: boolean;
  size?: "sm" | "md" | "lg";
}

export function PlayerHand({
  cards,
  selectedIndices = [],
  onCardClick,
  isLoading,
  size = "md",
}: PlayerHandProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-16 h-24 rounded-lg bg-white/10 animate-pulse"
          />
        ))}
        <span className="ml-4 text-white/60 text-sm">Decrypting cards...</span>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex items-center gap-2 text-white/40">
        <span>No cards yet</span>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2">
      {cards.map((card, index) => (
        <GameCard
          key={index}
          card={card}
          selected={selectedIndices.includes(index)}
          onClick={onCardClick ? () => onCardClick(index) : undefined}
          size={size}
        />
      ))}
    </div>
  );
}

"use client";

import Image from "next/image";
import { PokerTable } from "./PokerTable";

interface PlayerPosition {
  address: string;
  name: string;
  image: string;
  color: string;
  top: number;
  left: number;
  isCurrentPlayer: boolean;
}

interface GameTableProps {
  players: PlayerPosition[];
}

export function GameTable({ players }: GameTableProps) {
  return (
    <div
      className="relative z-10 h-screen flex items-center justify-center"
      style={{ perspective: "1000px", transform: "translateY(-10%)" }}
    >
      <div
        className="w-full h-[60%] mb-8 self-end"
        style={{ transform: "rotateX(65deg)" }}
      >
        <PokerTable />
      </div>

      {/* Players */}
      {players.map((player) => (
        <div
          key={player.address}
          className="absolute z-20"
          style={{ top: `${player.top}%`, left: `${player.left}%` }}
        >
          <div className="flex flex-col items-center gap-1 sm:gap-2">
            <div
              className={`w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-br ${player.color} p-0.5 ${player.isCurrentPlayer ? "ring-2 ring-white" : ""}`}
            >
              <div className="w-full h-full rounded-[7px] sm:rounded-[10px] bg-black/50 overflow-hidden">
                <Image
                  src={player.image}
                  alt={player.name}
                  width={56}
                  height={56}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-black/60 backdrop-blur rounded-full text-white text-[10px] sm:text-xs font-medium">
              {player.name}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

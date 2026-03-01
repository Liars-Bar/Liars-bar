"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { usePathname } from "next/navigation";

export function RetroWallet() {
  const pathname = usePathname();
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Hide on table pages — wallet info is in the floating player card
  const isOnTablePage = pathname?.startsWith("/table/");

  // Close dropdown on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  if (isOnTablePage) return null;

  if (connected && publicKey) {
    return (
      <div className="fixed top-2 right-3 z-50" ref={menuRef}>
        <button
          onClick={() => setShowMenu((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0a] text-green-400 text-[8px] hover:text-green-300 transition-all"
          style={{
            border: "2px solid #39ff14",
            boxShadow: showMenu
              ? "0 0 12px #39ff1450, 2px 2px 0 #0d7a0d"
              : "0 0 8px #39ff1430, 2px 2px 0 #0d7a0d",
          }}
        >
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full dot-pulse" />
          <span>{publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}</span>
          <span className="text-green-700 text-[7px]">{showMenu ? "▲" : "▼"}</span>
        </button>

        {showMenu && (
          <div
            className="absolute top-full right-0 mt-1 bg-[#0a0a0a] p-1.5 pixel-fade-in"
            style={{ border: "2px solid #ef4444", boxShadow: "0 0 8px #ef444430, 2px 2px 0 #7f1d1d", minWidth: "100%" }}
          >
            <button
              onClick={() => { disconnect(); setShowMenu(false); }}
              className="w-full text-left text-red-400 text-[8px] hover:text-red-300 hover:bg-red-500/10 transition px-2 py-1.5 whitespace-nowrap"
            >
              [X] DISCONNECT
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed top-2 right-3 z-50">
      <button
        onClick={() => setVisible(true)}
        className="retro-btn retro-btn-amber text-[8px] px-3 py-1.5 blink"
        style={{ animationDuration: "2s" }}
      >
        CONNECT WALLET
      </button>
    </div>
  );
}

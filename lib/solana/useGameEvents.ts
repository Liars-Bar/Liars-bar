/**
 * useGameEvents — React hook for game event detection
 *
 * Uses transaction polling as a reliable fallback since Alchemy's
 * WebSocket doesn't support logsSubscribe for program.addEventListener.
 *
 * Polls recent transactions on the table account, parses Anchor events
 * from their logs, and fires callbacks.
 *
 * Provides:
 *   - Animation triggers
 *   - Event log (for the sidebar panel)
 *   - Delegates game state updates to parent via onGameEvent
 *   - Proper cleanup on unmount
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { IDL } from "./idl";
import { PROGRAM_ID } from "./config";
import type {
  GameState,
  GameEventPayload,
  AnimationTrigger,
  AnimationType,
} from "./gameTypes";
import { createInitialGameState } from "./gameTypes";

// ============================================================================
// EVENT LOG ENTRY
// ============================================================================

export interface EventLogEntry {
  type: string;
  player?: string;
  timestamp: number;
  message: string;
}

// ============================================================================
// HOOK OPTIONS
// ============================================================================

export interface UseGameEventsOptions {
  tableId: string;
  /** Called when the on-chain state should be refetched */
  onRefetchTable?: () => void;
  /** Called for every event — parent uses this to update UI-driving state */
  onGameEvent?: (event: GameEventPayload) => void;
  /** Called when cards are shuffled for the current wallet */
  onCardsShuffled?: (nextPlayer: string) => void;
}

// ============================================================================
// ANIMATION DURATION MAP
// ============================================================================

const ANIMATION_DURATIONS: Record<AnimationType, number> = {
  "card-placed": 1500,
  "liar-called": 3000,
  "empty-bullet": 2500,
  "player-eliminated": 2000,
  "round-started": 2000,
  "player-joined": 1500,
};

// Polling interval in ms
const POLL_INTERVAL = 2000;

// ============================================================================
// HELPER: Map decoded Anchor event to GameEventPayload
// ============================================================================

function mapDecodedToPayload(
  decoded: { name: string; data: any },
  tableId: string,
): GameEventPayload | null {
  const d = decoded.data;

  // Filter by table ID
  const eventTableId = d.tableId?.toString?.();
  if (eventTableId && eventTableId !== tableId) {
    return null;
  }

  switch (decoded.name) {
    case "liarsTableCreated":
      return { type: "liarsTableCreated", tableId: d.tableId.toString() };
    case "playerJoined":
      return {
        type: "playerJoined",
        tableId: d.tableId.toString(),
        player: d.player.toString(),
      };
    case "suffleCardsForPlayer":
      return {
        type: "suffleCardsForPlayer",
        tableId: d.tableId.toString(),
        player: d.player.toString(),
        next: d.next.toString(),
      };
    case "roundStarted":
      return { type: "roundStarted", tableId: d.tableId.toString() };
    case "tableTrun":
      return {
        type: "tableTrun",
        tableId: d.tableId.toString(),
        player: d.player.toString(),
      };
    case "cardPlaced":
      return {
        type: "cardPlaced",
        tableId: d.tableId.toString(),
        player: d.player.toString(),
      };
    case "liarCalled":
      return {
        type: "liarCalled",
        tableId: d.tableId.toString(),
        caller: d.caller.toString(),
      };
    case "emptyBulletFired":
      return {
        type: "emptyBulletFired",
        tableId: d.tableId.toString(),
        player: d.player.toString(),
      };
    case "playerEleminated":
      return {
        type: "playerEleminated",
        tableId: d.tableId.toString(),
        player: d.player.toString(),
      };
    case "gameOver":
      return { type: "gameOver", tableId: d.tableId.toString() };
    case "gameWinner":
      return {
        type: "gameWinner",
        tableId: d.tableId.toString(),
        player: d.player.toString(),
      };
    default:
      return null;
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useGameEvents({
  tableId,
  onRefetchTable,
  onGameEvent,
  onCardsShuffled,
}: UseGameEventsOptions) {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const { publicKey } = useWallet();

  // Internal state for the event listener module
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState(tableId),
  );
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [activeAnimation, setActiveAnimation] =
    useState<AnimationTrigger | null>(null);

  // Stable refs for callbacks
  const onRefetchRef = useRef(onRefetchTable);
  onRefetchRef.current = onRefetchTable;
  const onGameEventRef = useRef(onGameEvent);
  onGameEventRef.current = onGameEvent;
  const onCardsShuffledRef = useRef(onCardsShuffled);
  onCardsShuffledRef.current = onCardsShuffled;

  // Short address helper
  const shorten = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  // ── Animation handler ──────────────────────────────────────
  const handleAnimation = useCallback((trigger: AnimationTrigger) => {
    setActiveAnimation(trigger);

    const duration = ANIMATION_DURATIONS[trigger.type] ?? 1500;
    setTimeout(() => {
      setActiveAnimation((current) =>
        current?.timestamp === trigger.timestamp ? null : current,
      );
    }, duration);
  }, []);

  // ── Event handler — builds event log AND forwards to parent ─
  const handleEvent = useCallback(
    (event: GameEventPayload) => {
      let message = "";
      let player: string | undefined;
      let animationType: AnimationType | null = null;

      switch (event.type) {
        case "liarsTableCreated":
          message = `Table created: ${shorten(event.tableId)}`;
          break;
        case "playerJoined":
          player = event.player;
          message = `${shorten(event.player)} joined the table`;
          animationType = "player-joined";
          break;
        case "suffleCardsForPlayer":
          player = event.player;
          message = `Cards shuffled for ${shorten(event.player)}, next: ${shorten(event.next)}`;
          break;
        case "roundStarted":
          message = "Round started!";
          animationType = "round-started";
          break;
        case "tableTrun":
          player = event.player;
          message = `Turn changed to ${shorten(event.player)}`;
          break;
        case "cardPlaced":
          player = event.player;
          message = `${shorten(event.player)} placed a card`;
          animationType = "card-placed";
          break;
        case "liarCalled":
          player = event.caller;
          message = `${shorten(event.caller)} called LIAR!`;
          animationType = "liar-called";
          break;
        case "emptyBulletFired":
          player = event.player;
          message = `${shorten(event.player)} fired an empty bullet - safe!`;
          animationType = "empty-bullet";
          break;
        case "playerEleminated":
          player = event.player;
          message = `${shorten(event.player)} was eliminated!`;
          animationType = "player-eliminated";
          break;
        case "gameOver":
          message = "Game over!";
          break;
        case "gameWinner":
          player = event.player;
          message = `${shorten(event.player)} wins the game!`;
          break;
      }

      // Update the event log (for the sidebar panel)
      setEventLog((prev) => [
        ...prev.slice(-49),
        { type: event.type, player, timestamp: Date.now(), message },
      ]);

      // Trigger animation if applicable
      if (animationType) {
        handleAnimation({
          type: animationType,
          player,
          timestamp: Date.now(),
        });
      }

      // Forward to parent for UI state updates
      onGameEventRef.current?.(event);
    },
    [handleAnimation],
  );

  // Stable ref for handleEvent
  const handleEventRef = useRef(handleEvent);
  handleEventRef.current = handleEvent;

  // ── Transaction polling for event detection ─────────────────
  useEffect(() => {
    if (!anchorWallet || !tableId) return;

    let isActive = true;
    let lastSignature: string | undefined;
    let isInitialized = false;

    const provider = new AnchorProvider(connection, anchorWallet, {
      commitment: "confirmed",
    });
    const program = new Program(IDL as any, provider);
    const eventParser = program.coder.events;

    // Derive table address
    const tableIdBN = new BN(tableId);
    const [tableAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("table"), tableIdBN.toArrayLike(Buffer, "le", 16)],
      PROGRAM_ID,
    );

    const walletStr = publicKey?.toString() ?? null;

    console.log(
      `%c[Poll][Init]%c Polling events for table ${tableId.slice(0, 8)}... (${tableAddress.toString().slice(0, 8)}...)`,
      "color: #39ff14; font-weight: bold",
      "color: #888",
    );

    const poll = async () => {
      if (!isActive) return;

      try {
        // Fetch recent signatures for the table account
        const signatures = await connection.getSignaturesForAddress(
          tableAddress,
          lastSignature ? { until: lastSignature, limit: 10 } : { limit: 1 },
          "confirmed",
        );

        if (signatures.length === 0) return;

        // On first poll, just record the latest signature (skip old events)
        if (!isInitialized) {
          lastSignature = signatures[0].signature;
          isInitialized = true;
          console.log(
            `%c[Poll][Init]%c Baseline signature: ${signatures[0].signature.slice(0, 16)}...`,
            "color: #39ff14; font-weight: bold",
            "color: #888",
          );
          return;
        }

        // Process from oldest to newest
        const newSigs = [...signatures].reverse();

        for (const sigInfo of newSigs) {
          if (sigInfo.err || !isActive) continue;

          try {
            const tx = await connection.getTransaction(sigInfo.signature, {
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0,
            });

            if (!tx?.meta?.logMessages) continue;

            // Parse Anchor events from transaction logs
            for (const log of tx.meta.logMessages) {
              if (!log.startsWith("Program data: ")) continue;

              const base64Data = log.slice("Program data: ".length);
              try {
                const decoded = eventParser.decode(base64Data);
                if (!decoded) continue;

                const payload = mapDecodedToPayload(decoded, tableId);
                if (!payload) continue;

                console.log(
                  `%c[Poll][Event]%c ${decoded.name}`,
                  "color: #39ff14; font-weight: bold",
                  "color: #888",
                  decoded.data,
                );

                // Handle shuffle callback for current wallet
                if (
                  payload.type === "suffleCardsForPlayer" &&
                  walletStr &&
                  payload.player === walletStr
                ) {
                  onCardsShuffledRef.current?.(payload.next);
                }

                // Update internal game state
                updateGameState(setGameState, payload);

                // Fire event handler (event log, animations, parent callback)
                handleEventRef.current(payload);
              } catch {
                // Not a valid event log — skip
              }
            }
          } catch (err) {
            console.warn("[Poll] Failed to fetch tx:", sigInfo.signature.slice(0, 16), err);
          }
        }

        // Update last processed signature
        lastSignature = signatures[0].signature;
      } catch (err) {
        console.error("[Poll] Error:", err);
      }
    };

    // Initial poll
    poll();

    // Poll on interval
    const interval = setInterval(poll, POLL_INTERVAL);

    return () => {
      isActive = false;
      clearInterval(interval);
      console.log(
        `%c[Poll][Cleanup]%c Stopped polling for table ${tableId.slice(0, 8)}...`,
        "color: #39ff14; font-weight: bold",
        "color: #888",
      );
    };
  }, [connection, anchorWallet, tableId, publicKey]);

  // Reset state when tableId changes
  useEffect(() => {
    setGameState(createInitialGameState(tableId));
    setEventLog([]);
    setActiveAnimation(null);
  }, [tableId]);

  return {
    gameState,
    setGameState,
    eventLog,
    activeAnimation,
  };
}

// ============================================================================
// HELPER: Update internal game state from event payload
// ============================================================================

function updateGameState(
  setGameState: (updater: (prev: GameState) => GameState) => void,
  payload: GameEventPayload,
) {
  switch (payload.type) {
    case "playerJoined": {
      const player = payload.player;
      setGameState((prev) => {
        const alreadyExists = prev.players.includes(player);
        return {
          ...prev,
          players: alreadyExists ? prev.players : [...prev.players, player],
          activePlayers: alreadyExists
            ? prev.activePlayers
            : [...prev.activePlayers, player],
          lastEvent: payload,
        };
      });
      break;
    }
    case "roundStarted":
      setGameState((prev) => ({
        ...prev,
        roundActive: true,
        currentTurn: null,
        moves: [],
        liarCaller: null,
        lastEvent: payload,
      }));
      break;
    case "suffleCardsForPlayer":
      setGameState((prev) => ({
        ...prev,
        currentTurn: payload.next,
        lastEvent: payload,
      }));
      break;
    case "tableTrun":
      setGameState((prev) => ({
        ...prev,
        currentTurn: payload.player,
        lastEvent: payload,
      }));
      break;
    case "cardPlaced":
      setGameState((prev) => ({
        ...prev,
        moves: [...prev.moves, { player: payload.player, timestamp: Date.now() }],
        lastEvent: payload,
      }));
      break;
    case "liarCalled":
      setGameState((prev) => ({
        ...prev,
        liarCaller: payload.caller,
        lastEvent: payload,
      }));
      break;
    case "playerEleminated":
      setGameState((prev) => ({
        ...prev,
        activePlayers: prev.activePlayers.filter((p) => p !== payload.player),
        lastEvent: payload,
      }));
      break;
    default:
      setGameState((prev) => ({ ...prev, lastEvent: payload }));
      break;
  }
}

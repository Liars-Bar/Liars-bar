/**
 * WebSocket Event Listener Module for Liar's Bar
 *
 * Subscribes to Anchor program events using program.addEventListener.
 * Provides structured logging, table-scoped filtering, and cleanup.
 *
 * Usage:
 *   const cleanup = registerEventListeners({ program, tableId, setGameState, onAnimation, walletPublicKey });
 *   // on unmount:
 *   cleanup();
 */

import { Program } from "@coral-xyz/anchor";
import type {
  GameState,
  GameEventPayload,
  AnimationTrigger,
  LiarsTableCreatedEvent,
  PlayerJoinedEvent,
  SuffleCardsForPlayerEvent,
  RoundStartedEvent,
  TableTrunEvent,
  CardPlacedEvent,
  LiarCalledEvent,
  EmptyBulletFiredEvent,
  PlayerEleminatedEvent,
} from "./gameTypes";

// ============================================================================
// STRUCTURED LOGGER
// ============================================================================

function wsLog(eventName: string, payload: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(
    `%c[WS][${eventName}]%c ${timestamp}`,
    "color: #39ff14; font-weight: bold",
    "color: #666",
    payload,
  );
}

// ============================================================================
// TYPES
// ============================================================================

export interface EventListenerOptions {
  /** The Anchor program instance */
  program: Program;
  /** The current table ID (as string) to filter events */
  tableId: string;
  /** React state setter for GameState — uses functional updates */
  setGameState: (updater: (prev: GameState) => GameState) => void;
  /** Callback for triggering UI animations */
  onAnimation?: (trigger: AnimationTrigger) => void;
  /** Callback fired for every matching event (for event log, etc.) */
  onEvent?: (event: GameEventPayload) => void;
  /** Current wallet public key string — used for private card events */
  walletPublicKey?: string | null;
  /** Callback when cards are shuffled for the current player */
  onCardsShuffled?: (nextPlayer: string) => void;
}

export interface EventListenerCleanup {
  (): void;
}

// ============================================================================
// REGISTER ALL EVENT LISTENERS
// ============================================================================

export function registerEventListeners(
  options: EventListenerOptions,
): EventListenerCleanup {
  const {
    program,
    tableId,
    setGameState,
    onAnimation,
    onEvent,
    walletPublicKey,
    onCardsShuffled,
  } = options;

  const listenerIds: number[] = [];


  // Debug: log the program ID being used for subscriptions
  console.log(
    `%c[WS][Debug]%c Program ID: ${program.programId.toString()}, tableId filter: ${tableId}`,
    "color: #ff6600; font-weight: bold",
    "color: #888",
  );

  // Helper: check if event is for our table
  function isOurTable(eventTableId: { toString(): string }): boolean {
    const eventTable = eventTableId.toString();
    const match = eventTable === tableId;
    if (!match) {
      console.log(
        `[WS][Filter] Event tableId=${eventTable} !== our tableId=${tableId}, skipping`,
      );
    }
    return match;
  }

  // ── LiarsTableCreated ───────────────────────────────────────
  const liarsTableCreatedId = program.addEventListener(
    "liarsTableCreated",
    (event: LiarsTableCreatedEvent) => {
      console.log("[WS][RAW] liarsTableCreated fired!", event);
      if (!isOurTable(event.tableId)) return;

      const payload: GameEventPayload = {
        type: "liarsTableCreated",
        tableId: event.tableId.toString(),
      };

      wsLog("LiarsTableCreated", { table_id: event.tableId.toString() });

      setGameState((prev) => ({
        ...prev,
        lastEvent: payload,
      }));

      onEvent?.(payload);
    },
  );
  listenerIds.push(liarsTableCreatedId);

  // ── PlayerJoined ────────────────────────────────────────────
  const playerJoinedId = program.addEventListener(
    "playerJoined",
    (event: PlayerJoinedEvent) => {
      console.log("[WS][RAW] playerJoined fired!", event);
      if (!isOurTable(event.tableId)) return;

      const player = event.player.toString();
      const payload: GameEventPayload = {
        type: "playerJoined",
        tableId: event.tableId.toString(),
        player,
      };

      wsLog("PlayerJoined", {
        table_id: event.tableId.toString(),
        player,
      });

      setGameState((prev) => {
        // Prevent duplicates
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

      onAnimation?.({
        type: "player-joined",
        player,
        timestamp: Date.now(),
      });

      onEvent?.(payload);
    },
  );
  listenerIds.push(playerJoinedId);

  // ── SuffleCardsForPlayer ────────────────────────────────────
  const suffleCardsId = program.addEventListener(
    "suffleCardsForPlayer",
    (event: SuffleCardsForPlayerEvent) => {
      if (!isOurTable(event.tableId)) return;

      const player = event.player.toString();
      const next = event.next.toString();
      const payload: GameEventPayload = {
        type: "suffleCardsForPlayer",
        tableId: event.tableId.toString(),
        player,
        next,
      };

      wsLog("SuffleCardsForPlayer", {
        table_id: event.tableId.toString(),
        player,
        next,
      });

      // If this shuffle was for our wallet, notify for card decryption
      if (walletPublicKey && player === walletPublicKey) {
        onCardsShuffled?.(next);
      }

      setGameState((prev) => ({
        ...prev,
        currentTurn: next,
        lastEvent: payload,
      }));

      onEvent?.(payload);
    },
  );
  listenerIds.push(suffleCardsId);

  // ── RoundStarted ────────────────────────────────────────────
  const roundStartedId = program.addEventListener(
    "roundStarted",
    (event: RoundStartedEvent) => {
      if (!isOurTable(event.tableId)) return;

      const payload: GameEventPayload = {
        type: "roundStarted",
        tableId: event.tableId.toString(),
      };

      wsLog("RoundStarted", { table_id: event.tableId.toString() });

      setGameState((prev) => ({
        ...prev,
        roundActive: true,
        currentTurn: null,
        moves: [],
        liarCaller: null,
        lastEvent: payload,
      }));

      onAnimation?.({
        type: "round-started",
        timestamp: Date.now(),
      });

      onEvent?.(payload);
    },
  );
  listenerIds.push(roundStartedId);

  // ── TableTrun (Turn Changed) ────────────────────────────────
  const tableTrunId = program.addEventListener(
    "tableTrun",
    (event: TableTrunEvent) => {
      if (!isOurTable(event.tableId)) return;

      const player = event.player.toString();
      const payload: GameEventPayload = {
        type: "tableTrun",
        tableId: event.tableId.toString(),
        player,
      };

      wsLog("TableTrun", {
        table_id: event.tableId.toString(),
        player,
      });

      setGameState((prev) => ({
        ...prev,
        currentTurn: player,
        lastEvent: payload,
      }));

      onEvent?.(payload);
    },
  );
  listenerIds.push(tableTrunId);

  // ── CardPlaced ──────────────────────────────────────────────
  const cardPlacedId = program.addEventListener(
    "cardPlaced",
    (event: CardPlacedEvent) => {
      if (!isOurTable(event.tableId)) return;

      const player = event.player.toString();
      const payload: GameEventPayload = {
        type: "cardPlaced",
        tableId: event.tableId.toString(),
        player,
      };

      wsLog("CardPlaced", {
        table_id: event.tableId.toString(),
        player,
      });

      setGameState((prev) => ({
        ...prev,
        moves: [...prev.moves, { player, timestamp: Date.now() }],
        lastEvent: payload,
      }));

      onAnimation?.({
        type: "card-placed",
        player,
        timestamp: Date.now(),
      });

      onEvent?.(payload);
    },
  );
  listenerIds.push(cardPlacedId);

  // ── LiarCalled ──────────────────────────────────────────────
  const liarCalledId = program.addEventListener(
    "liarCalled",
    (event: LiarCalledEvent) => {
      if (!isOurTable(event.tableId)) return;

      const caller = event.caller.toString();
      const payload: GameEventPayload = {
        type: "liarCalled",
        tableId: event.tableId.toString(),
        caller,
      };

      wsLog("LiarCalled", {
        table_id: event.tableId.toString(),
        caller,
      });

      setGameState((prev) => ({
        ...prev,
        liarCaller: caller,
        lastEvent: payload,
      }));

      onAnimation?.({
        type: "liar-called",
        player: caller,
        timestamp: Date.now(),
      });

      onEvent?.(payload);
    },
  );
  listenerIds.push(liarCalledId);

  // ── EmptyBulletFired ────────────────────────────────────────
  const emptyBulletId = program.addEventListener(
    "emptyBulletFired",
    (event: EmptyBulletFiredEvent) => {
      if (!isOurTable(event.tableId)) return;

      const player = event.player.toString();
      const payload: GameEventPayload = {
        type: "emptyBulletFired",
        tableId: event.tableId.toString(),
        player,
      };

      wsLog("EmptyBulletFired", {
        table_id: event.tableId.toString(),
        player,
      });

      setGameState((prev) => ({
        ...prev,
        lastEvent: payload,
      }));

      onAnimation?.({
        type: "empty-bullet",
        player,
        timestamp: Date.now(),
      });

      onEvent?.(payload);
    },
  );
  listenerIds.push(emptyBulletId);

  // ── PlayerEleminated ────────────────────────────────────────
  const playerEleminatedId = program.addEventListener(
    "playerEleminated",
    (event: PlayerEleminatedEvent) => {
      if (!isOurTable(event.tableId)) return;

      const player = event.player.toString();
      const payload: GameEventPayload = {
        type: "playerEleminated",
        tableId: event.tableId.toString(),
        player,
      };

      wsLog("PlayerEleminated", {
        table_id: event.tableId.toString(),
        player,
      });

      setGameState((prev) => ({
        ...prev,
        activePlayers: prev.activePlayers.filter((p) => p !== player),
        lastEvent: payload,
      }));

      onAnimation?.({
        type: "player-eliminated",
        player,
        timestamp: Date.now(),
      });

      onEvent?.(payload);
    },
  );
  listenerIds.push(playerEleminatedId);

  // Debug: log all listener IDs
  console.log(
    `%c[WS][Debug]%c Registered ${listenerIds.length} listeners, IDs: [${listenerIds.join(", ")}]`,
    "color: #ff6600; font-weight: bold",
    "color: #888",
  );

  // ── CLEANUP ─────────────────────────────────────────────────
  return () => {
    wsLog("Cleanup", {
      message: "Removing all event listeners",
      count: listenerIds.length,
    });

    for (const id of listenerIds) {
      program.removeEventListener(id).catch((err) => {
        console.warn("[WS][Cleanup] Failed to remove listener:", id, err);
      });
    }
  };
}

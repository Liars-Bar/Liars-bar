/**
 * Game State & Event Types for Liar's Bar
 *
 * Shared types used across the WebSocket event listener,
 * game state hooks, and UI components.
 */

// ============================================================================
// GAME STATE
// ============================================================================

export interface Move {
  player: string;
  timestamp: number;
  cardCount?: number;
}

export interface GameState {
  tableId: string;
  players: string[];
  activePlayers: string[];
  currentTurn: string | null;
  moves: Move[];
  roundActive: boolean;
  liarCaller: string | null;
  lastEvent: GameEventPayload | null;
}

export function createInitialGameState(tableId: string): GameState {
  return {
    tableId,
    players: [],
    activePlayers: [],
    currentTurn: null,
    moves: [],
    roundActive: false,
    liarCaller: null,
    lastEvent: null,
  };
}

// ============================================================================
// ANCHOR EVENT PAYLOADS (as emitted by the on-chain program)
// ============================================================================

export interface LiarsTableCreatedEvent {
  tableId: { toString(): string };
}

export interface PlayerJoinedEvent {
  tableId: { toString(): string };
  player: { toString(): string };
}

export interface SuffleCardsForPlayerEvent {
  tableId: { toString(): string };
  player: { toString(): string };
  next: { toString(): string };
}

export interface RoundStartedEvent {
  tableId: { toString(): string };
}

export interface TableTrunEvent {
  tableId: { toString(): string };
  player: { toString(): string };
}

export interface CardPlacedEvent {
  tableId: { toString(): string };
  player: { toString(): string };
}

export interface LiarCalledEvent {
  tableId: { toString(): string };
  caller: { toString(): string };
}

export interface EmptyBulletFiredEvent {
  tableId: { toString(): string };
  player: { toString(): string };
}

export interface PlayerEleminatedEvent {
  tableId: { toString(): string };
  player: { toString(): string };
}

// ============================================================================
// GAME EVENT UNION (normalized, with string values)
// ============================================================================

export type GameEventPayload =
  | { type: "liarsTableCreated"; tableId: string }
  | { type: "playerJoined"; tableId: string; player: string }
  | { type: "suffleCardsForPlayer"; tableId: string; player: string; next: string }
  | { type: "roundStarted"; tableId: string }
  | { type: "tableTrun"; tableId: string; player: string }
  | { type: "cardPlaced"; tableId: string; player: string }
  | { type: "liarCalled"; tableId: string; caller: string }
  | { type: "emptyBulletFired"; tableId: string; player: string }
  | { type: "playerEleminated"; tableId: string; player: string };

// ============================================================================
// ANIMATION TRIGGER TYPES
// ============================================================================

export type AnimationType =
  | "card-placed"
  | "liar-called"
  | "empty-bullet"
  | "player-eliminated"
  | "round-started"
  | "player-joined";

export interface AnimationTrigger {
  type: AnimationType;
  player?: string;
  timestamp: number;
}

// ============================================================================
// CONNECTION STATUS
// ============================================================================

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

/**
 * Solana Integration Module
 *
 * This module provides all Solana and Inco Network integration utilities
 * for the Liar's Bar DApp.
 */

// Configuration
export {
  PROGRAM_ID_STRING,
  INCO_LIGHTNING_PROGRAM_ID_STRING,
  PROGRAM_ID,
  INCO_LIGHTNING_PROGRAM_ID,
  SOLANA_RPC_ENDPOINT,
  SOLANA_WS_ENDPOINT,
} from "./config";

// IDL and Types
export { IDL, type LiarsBarDapp } from "./idl";

// Inco Types and Utilities
export {
  type Euint128,
  type EncryptedCard,
  euint128ToHandle,
  handleToEuint128,
  isEuint128,
  zeroEuint128,
  IncoOperations,
  type IncoOperation,
  type DecryptionResult,
  type DecryptOptions,
  MAX_DECRYPT_HANDLES,
  ATTESTED_DECRYPT_ENDPOINT,
  COVALIDATOR_PUBLIC_KEY,
} from "./incoTypes";

// Hooks
export { useCreateTable } from "./useCreateTable";
export { useTable } from "./useTable";
export { useTableSubscription, type GameEvent } from "./useTableSubscription";
export { useIncoRandom, type DecryptedRandomResult } from "./useIncoRandom";
export { useGameEvents, type EventLogEntry } from "./useGameEvents";
export { useConnectionStatus } from "./useConnectionStatus";

// Event Listener Module
export {
  registerEventListeners,
  type EventListenerOptions,
  type EventListenerCleanup,
} from "./eventListener";

// Game Types
export {
  type GameState as WebSocketGameState,
  type GameEventPayload,
  type AnimationTrigger,
  type AnimationType,
  type ConnectionStatus,
  type Move,
  createInitialGameState,
} from "./gameTypes";

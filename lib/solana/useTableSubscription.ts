import { useEffect, useRef, useCallback } from "react";
import { PublicKey, Logs } from "@solana/web3.js";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { IDL } from "./idl";
import { PROGRAM_ID } from "./config";

// Event types from the IDL
export type GameEvent =
  | { type: "playerJoined"; data: { tableId: string; player: string } }
  | { type: "roundStarted"; data: { tableId: string } }
  | { type: "cardPlaced"; data: { tableId: string; player: string } }
  | { type: "liarCalled"; data: { tableId: string; caller: string } }
  | { type: "playerEleminated"; data: { tableId: string; player: string } }
  | { type: "tableTrun"; data: { tableId: string; player: string } }
  | { type: "suffleCardsForPlayer"; data: { tableId: string; player: string; next: string } }
  | { type: "emptyBulletFired"; data: { tableId: string; player: string } }
  | { type: "liarsTableCreated"; data: { tableId: string } };

interface UseTableSubscriptionOptions {
  tableIdString: string;
  onEvent?: (event: GameEvent) => void;
  onAccountChange?: () => void;
}

export function useTableSubscription({
  tableIdString,
  onEvent,
  onAccountChange,
}: UseTableSubscriptionOptions) {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const subscriptionRef = useRef<number | null>(null);
  const accountSubscriptionRef = useRef<number | null>(null);

  // Derive table PDA (using 16 bytes for u128)
  const getTableAddress = useCallback(() => {
    const tableId = new BN(tableIdString);
    const [tableAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("table"), tableId.toArrayLike(Buffer, "le", 16)],
      PROGRAM_ID
    );
    return tableAddress;
  }, [tableIdString]);

  // Parse program logs to extract events
  const parseLogsForEvents = useCallback(
    (logs: string[]): GameEvent[] => {
      const events: GameEvent[] = [];

      if (!anchorWallet) return events;

      try {
        const provider = new AnchorProvider(connection, anchorWallet, {
          commitment: "confirmed",
        });
        const program = new Program(IDL as any, provider);
        const eventParser = program.coder.events;

        for (const log of logs) {
          // Anchor events are base64 encoded after "Program data: "
          if (log.startsWith("Program data: ")) {
            const base64Data = log.slice("Program data: ".length);
            try {
              const event = eventParser.decode(base64Data);
              if (event) {
                const gameEvent = mapAnchorEventToGameEvent(event);
                if (gameEvent && isEventForTable(gameEvent, tableIdString)) {
                  events.push(gameEvent);
                }
              }
            } catch {
              // Not all program data logs are events
            }
          }
        }
      } catch (err) {
        console.error("Error parsing logs:", err);
      }

      return events;
    },
    [connection, anchorWallet, tableIdString]
  );

  // Subscribe to program logs (for events)
  useEffect(() => {
    if (!onEvent) return;

    const subscribeToLogs = async () => {
      try {
        subscriptionRef.current = connection.onLogs(
          PROGRAM_ID,
          (logs: Logs) => {
            if (logs.err) return;

            const events = parseLogsForEvents(logs.logs);
            events.forEach((event) => {
              onEvent(event);
            });
          },
          "confirmed"
        );

      } catch (err) {
        console.error("Error subscribing to logs:", err);
      }
    };

    subscribeToLogs();

    return () => {
      if (subscriptionRef.current !== null) {
        connection.removeOnLogsListener(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [connection, onEvent, parseLogsForEvents]);

  // Subscribe to account changes (for table data updates)
  useEffect(() => {
    if (!onAccountChange) return;

    const tableAddress = getTableAddress();

    const subscribeToAccount = async () => {
      try {
        accountSubscriptionRef.current = connection.onAccountChange(
          tableAddress,
          () => {
            onAccountChange();
          },
          "confirmed"
        );

      } catch (err) {
        console.error("Error subscribing to account:", err);
      }
    };

    subscribeToAccount();

    return () => {
      if (accountSubscriptionRef.current !== null) {
        connection.removeAccountChangeListener(accountSubscriptionRef.current);
        accountSubscriptionRef.current = null;
      }
    };
  }, [connection, getTableAddress, onAccountChange]);

  return {
    isSubscribed: subscriptionRef.current !== null || accountSubscriptionRef.current !== null,
  };
}

// Helper to map Anchor event to our GameEvent type
function mapAnchorEventToGameEvent(event: { name: string; data: any }): GameEvent | null {
  switch (event.name) {
    case "playerJoined":
      return {
        type: "playerJoined",
        data: {
          tableId: event.data.tableId.toString(),
          player: event.data.player.toString(),
        },
      };
    case "roundStarted":
      return {
        type: "roundStarted",
        data: {
          tableId: event.data.tableId.toString(),
        },
      };
    case "cardPlaced":
      return {
        type: "cardPlaced",
        data: {
          tableId: event.data.tableId.toString(),
          player: event.data.player.toString(),
        },
      };
    case "liarCalled":
      return {
        type: "liarCalled",
        data: {
          tableId: event.data.tableId.toString(),
          caller: event.data.caller.toString(),
        },
      };
    case "playerEleminated":
      return {
        type: "playerEleminated",
        data: {
          tableId: event.data.tableId.toString(),
          player: event.data.player.toString(),
        },
      };
    case "tableTrun":
      return {
        type: "tableTrun",
        data: {
          tableId: event.data.tableId.toString(),
          player: event.data.player.toString(),
        },
      };
    case "suffleCardsForPlayer":
      return {
        type: "suffleCardsForPlayer",
        data: {
          tableId: event.data.tableId.toString(),
          player: event.data.player.toString(),
          next: event.data.next.toString(),
        },
      };
    case "emptyBulletFired":
      return {
        type: "emptyBulletFired",
        data: {
          tableId: event.data.tableId.toString(),
          player: event.data.player.toString(),
        },
      };
    case "liarsTableCreated":
      return {
        type: "liarsTableCreated",
        data: {
          tableId: event.data.tableId.toString(),
        },
      };
    default:
      return null;
  }
}

// Helper to check if event is for our table
function isEventForTable(event: GameEvent, tableIdString: string): boolean {
  return event.data.tableId === tableIdString;
}

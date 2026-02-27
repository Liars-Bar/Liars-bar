import { useCallback, useState, useEffect, useRef } from "react";
import {
  useConnection,
  useWallet,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
  Transaction,
} from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { IDL } from "./idl";
import { useTableSubscription } from "./useTableSubscription";
import { useGameEvents } from "./useGameEvents";
import { useConnectionStatus } from "./useConnectionStatus";
import { PROGRAM_ID, INCO_LIGHTNING_PROGRAM_ID } from "./config";
import { decrypt } from "@inco/solana-sdk";
import type {
  AccountMeta,
  SimulatedTransactionResponse,
} from "@solana/web3.js";
import type { AnimationTrigger } from "./gameTypes";

// ============================================================================
// INCO ALLOWANCE HELPERS
// ============================================================================

/**
 * Derive allowance PDA from a bigint handle (as per Inco docs)
 * Seeds: [handle.to_le_bytes() (16 bytes), allowed_address (32 bytes)]
 */
function deriveAllowancePDAFromHandle(
  handle: bigint,
  allowedAddress: PublicKey,
): PublicKey {
  // Convert handle to 16-byte little-endian buffer
  const handleBuffer = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    handleBuffer[i] = Number((handle >> BigInt(i * 8)) & BigInt(0xff));
  }

  const [allowanceAccount] = PublicKey.findProgramAddressSync(
    [handleBuffer, allowedAddress.toBuffer()],
    INCO_LIGHTNING_PROGRAM_ID,
  );

  return allowanceAccount;
}

/**
 * Parse Inco handles from simulation logs/return data.
 * Looks for handles in various formats that Inco might output.
 */
function parseHandlesFromSimulation(
  simulation: SimulatedTransactionResponse,
): bigint[] {
  const handles: bigint[] = [];
  const logs = simulation.logs || [];

  for (const log of logs) {
    // Pattern 1: Look for "result=<decimal_number>" in Inco event logs
    // e.g., "AS_EUINT128 Event: lhs=3, result=278485709450327982344214003977400276313"
    const resultMatches = log.matchAll(/result=(\d+)/g);
    for (const match of resultMatches) {
      const decimalStr = match[1];
      try {
        const handleValue = BigInt(decimalStr);
        if (handleValue !== BigInt(0)) {
          handles.push(handleValue);
        }
      } catch (e) {
        // Skip invalid values
      }
    }

    // Pattern 2: Look for hex values that could be handles (32 hex chars = 16 bytes = u128)
    // Only match if contains at least one letter (a-f) to avoid matching decimal numbers
    const hexMatches = log.matchAll(/(?:0x)([0-9a-fA-F]{32})/g);
    for (const match of hexMatches) {
      const handleHex = match[1];
      const handleValue = BigInt("0x" + handleHex);
      if (handleValue !== BigInt(0)) {
        handles.push(handleValue);
      }
    }
  }

  // Parse from returnData if available
  if (simulation.returnData?.data) {
    try {
      const [base64Data, encoding] = simulation.returnData.data;
      const buffer = Buffer.from(
        base64Data,
        encoding === "base64" ? "base64" : "utf8",
      );
      // Each handle is 16 bytes (u128) in little-endian
      for (let i = 0; i + 16 <= buffer.length; i += 16) {
        let handleValue = BigInt(0);
        for (let j = 0; j < 16; j++) {
          handleValue |= BigInt(buffer[i + j]) << BigInt(j * 8);
        }
        if (handleValue !== BigInt(0)) {
          handles.push(handleValue);
        }
      }
    } catch {
      // Failed to parse returnData
    }
  }

  // Deduplicate
  const uniqueHandles = [...new Set(handles.map((h) => h.toString()))].map(
    (s) => BigInt(s),
  );
  return uniqueHandles;
}

// ── Transaction confirmation with timeout ──────────────────────
async function confirmWithTimeout(
  connection: import("@solana/web3.js").Connection,
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
  timeoutMs = 60_000,
): Promise<void> {
  await Promise.race([
    connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    ),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Transaction timed out after 60s. Check your wallet or Solscan.",
            ),
          ),
        timeoutMs,
      ),
    ),
  ]);
}

// Extract u128 handle from Anchor-deserialized Euint128 tuple struct
function extractHandle(euint128: any): bigint {
  if (euint128 && euint128._bn) return BigInt(euint128.toString());
  if (euint128 && euint128["0"]) return BigInt(euint128["0"].toString());
  if (Array.isArray(euint128) && euint128.length > 0)
    return BigInt(euint128[0].toString());
  return BigInt(0);
}

// Decrypted card for display
export interface DecryptedCard {
  shape: number; // 0-3 for suits
  value: number; // 1-13 for card values
}

// ── Card cache helpers (localStorage) ──────────────────────────
interface CardCache {
  fingerprint: string;
  cards: DecryptedCard[];
}

function getCardCacheKey(tableId: string, wallet: string): string {
  return `liar-cards-${tableId}-${wallet}`;
}

function getEncryptedFingerprint(encryptedCards: any[]): string {
  // Build a fingerprint from encrypted card handles so cache invalidates on new round
  try {
    return encryptedCards
      .map(
        (c: any) =>
          `${c?.shape?.toString?.() ?? ""}:${c?.value?.toString?.() ?? ""}`,
      )
      .join("|");
  } catch {
    return "";
  }
}

function loadCachedCards(
  tableId: string,
  wallet: string,
  encryptedCards: any[],
): DecryptedCard[] | null {
  try {
    const key = getCardCacheKey(tableId, wallet);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const cached: CardCache = JSON.parse(raw);
    const currentFingerprint = getEncryptedFingerprint(encryptedCards);

    if (cached.fingerprint === currentFingerprint && cached.cards.length > 0) {
      console.log(
        "[Cache] Loaded cached decrypted cards:",
        cached.cards.length,
      );
      return cached.cards;
    }
    // Fingerprint mismatch — new round / different cards
    localStorage.removeItem(key);
    return null;
  } catch {
    return null;
  }
}

function saveCachedCards(
  tableId: string,
  wallet: string,
  encryptedCards: any[],
  cards: DecryptedCard[],
): void {
  try {
    const key = getCardCacheKey(tableId, wallet);
    const cache: CardCache = {
      fingerprint: getEncryptedFingerprint(encryptedCards),
      cards,
    };
    localStorage.setItem(key, JSON.stringify(cache));
    console.log("[Cache] Saved decrypted cards:", cards.length);
  } catch {
    // localStorage might be full or unavailable — ignore
  }
}

function clearCardCache(tableId: string, wallet: string): void {
  try {
    localStorage.removeItem(getCardCacheKey(tableId, wallet));
  } catch {
    // ignore
  }
}

export interface PlayerInfo {
  address: string;
  characterId: string | null;
  isEliminated?: boolean;
  encryptedCards?: any[]; // Raw encrypted cards from chain
}

export type GameState = "lobby" | "playing" | "ended";

export interface GameEventLog {
  type: string;
  player?: string;
  timestamp: number;
  message: string;
}

export interface TableData {
  tableId: string;
  players: string[];
  playerInfos: PlayerInfo[];
  isOpen: boolean;
  tableCard: number;
  trunToPlay: number;
  cardsOnTable: number; // count of encrypted cards placed on the table
}

export function useTable(tableIdString: string) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signTransaction } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isQuitting, setIsQuitting] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Game state tracking
  const [gameState, setGameState] = useState<GameState>("lobby");
  const [currentTurnPlayer, setCurrentTurnPlayer] = useState<string | null>(
    null,
  );
  const [eventLog, setEventLog] = useState<GameEventLog[]>([]);
  const [shuffleTurn, setShuffleTurn] = useState<number>(-1); // -1 means no one should shuffle

  // Animation state from WebSocket events
  const [activeAnimation, setActiveAnimation] =
    useState<AnimationTrigger | null>(null);

  // Card decryption state
  const [myCards, setMyCards] = useState<DecryptedCard[]>([]);
  const [isDecryptingCards, setIsDecryptingCards] = useState(false);
  const [decryptFailed, setDecryptFailed] = useState(false);
  // Maps "shapeHandle:valueHandle" → DecryptedCard so we can rebuild myCards from on-chain state
  const cardHandleMap = useRef<Map<string, DecryptedCard>>(new Map());

  // Track last claim (who placed cards last)
  const [lastClaimBy, setLastClaimBy] = useState<string | null>(null);
  const [isPlacingCards, setIsPlacingCards] = useState(false);
  const [isCallingLiar, setIsCallingLiar] = useState(false);
  const [liarCaller, setLiarCaller] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);
  const { signMessage } = useWallet();

  // Derive table PDA
  const getTableAddress = useCallback(() => {
    const tableId = new BN(tableIdString);
    const [tableAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("table"), tableId.toArrayLike(Buffer, "le", 16)],
      PROGRAM_ID,
    );
    console.log("[DEBUG] PROGRAM_ID:", PROGRAM_ID.toBase58());
    console.log("[DEBUG] Table PDA:", tableAddress.toBase58());
    console.log(
      "[DEBUG] tableId BN:",
      tableId.toString(),
      "hex:",
      tableId.toArrayLike(Buffer, "le", 16).toString("hex"),
    );
    return tableAddress;
  }, [tableIdString]);

  // Track if initial fetch is done for the current wallet
  const initialFetchDone = useRef(false);
  const lastWalletKey = useRef<string | null>(null);

  // Ref to track if shuffle is in progress (avoids stale closure issues)
  const isShufflingRef = useRef(false);

  // Debounce ref for fetchTable — prevents flooding RPC on bursts of events
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref to access current tableData without causing subscription re-creation
  const tableDataRef = useRef<TableData | null>(null);

  // Fetch table data
  const fetchTable = useCallback(
    async (isInitialFetch = false) => {
      try {
        // Only show loading spinner on initial fetch
        if (isInitialFetch) {
          setIsLoading(true);
        }
        const tableAddress = getTableAddress();

        const accountInfo = await connection.getAccountInfo(tableAddress);
        if (!accountInfo) {
          setError("Table not found");
          setTableData(null);
          return;
        }

        // Create provider for decoding
        if (!anchorWallet) {
          // Wallet not connected yet - keep loading state to prevent showing character selection
          // The effect will re-run when anchorWallet becomes available
          return;
        }

        const provider = new AnchorProvider(connection, anchorWallet, {
          commitment: "confirmed",
        });
        const program = new Program(IDL as any, provider);
        console.log(
          "[DEBUG] Anchor program.programId:",
          program.programId.toBase58(),
        );

        const table = await (program.account as any).liarsTable.fetch(
          tableAddress,
        );
        const playerAddresses = table.players.map((p: PublicKey) =>
          p.toString(),
        );

        // Fetch character IDs from on-chain player accounts
        const tableId = new BN(tableIdString);
        const playerInfos: PlayerInfo[] = await Promise.all(
          playerAddresses.map(async (address: string) => {
            try {
              // Derive player PDA
              const [playerPDA] = PublicKey.findProgramAddressSync(
                [
                  Buffer.from("player"),
                  tableId.toArrayLike(Buffer, "le", 16),
                  new PublicKey(address).toBuffer(),
                ],
                PROGRAM_ID,
              );
              console.log(
                "[DEBUG] Player PDA for",
                address,
                ":",
                playerPDA.toBase58(),
              );

              // Fetch player account
              const playerAccount = await (program.account as any).player.fetch(
                playerPDA,
              );
              return {
                address,
                characterId: playerAccount.characterId || null,
                encryptedCards: playerAccount.cards || [],
              };
            } catch {
              // Player account might not exist yet (table creator before joining)
              return {
                address,
                characterId: null,
                encryptedCards: [],
              };
            }
          }),
        );

        const newTableData = {
          tableId: table.tableId.toString(),
          players: playerAddresses,
          playerInfos,
          isOpen: table.isOpen,
          tableCard: table.tableCard,
          trunToPlay: table.trunToPlay,
          cardsOnTable: Array.isArray(table.cardsOnTable)
            ? table.cardsOnTable.length
            : 0,
        };
        tableDataRef.current = newTableData;
        setTableData(newTableData);

        // Update shuffle turn from chain data
        const chainShuffleTurn =
          typeof table.suffleTrun === "number" ? table.suffleTrun : -1;
        setShuffleTurn(chainShuffleTurn);

        // Track game over
        setIsOver(!!table.isOver);

        // Update game state based on table status
        if (table.isOver) {
          setGameState("ended");
        } else if (table.isOpen) {
          setGameState("lobby");
        } else if (playerAddresses.length > 0) {
          setGameState("playing");
          // Set current turn player from table data
          if (
            table.trunToPlay >= 0 &&
            table.trunToPlay < playerAddresses.length
          ) {
            setCurrentTurnPlayer(playerAddresses[table.trunToPlay]);
          }
        }

        setError(null);
      } catch (err: any) {
        console.error("Error fetching table:", err);
        setError(err.message || "Failed to fetch table");
      } finally {
        if (isInitialFetch) {
          setIsLoading(false);
        }
      }
    },
    [connection, anchorWallet, tableIdString, getTableAddress],
  );

  // Debounced fetchTable — collapses rapid event bursts into a single RPC call
  const debouncedFetchTable = useCallback(() => {
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => fetchTable(false), 400);
  }, [fetchTable]);

  // Join table with character selection
  const joinTable = useCallback(
    async (characterId: string): Promise<boolean> => {
      if (!publicKey || !anchorWallet || !sendTransaction) {
        setError("Wallet not connected");
        return false;
      }

      if (!characterId) {
        setError("Please select a character");
        return false;
      }

      // Check if character is already taken
      const takenCharacters =
        tableData?.playerInfos
          .filter((p) => p.characterId !== null)
          .map((p) => p.characterId) || [];

      if (takenCharacters.includes(characterId)) {
        setError("This character is already taken by another player");
        return false;
      }

      setIsJoining(true);
      setError(null);

      try {
        const provider = new AnchorProvider(connection, anchorWallet, {
          commitment: "confirmed",
        });
        const program = new Program(IDL as any, provider);

        const tableId = new BN(tableIdString);
        const tableAddress = getTableAddress();

        // Derive player PDA
        const [playerAddress] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("player"),
            tableId.toArrayLike(Buffer, "le", 16),
            publicKey.toBuffer(),
          ],
          PROGRAM_ID,
        );

        // Check if player account already exists (already joined)
        const existingAccount = await connection.getAccountInfo(playerAddress);
        if (existingAccount) {
          // Player already joined — refresh table data instead of sending a failing tx
          await fetchTable();
          return true;
        }

        // Build compute budget instructions
        const computeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({
          units: 200_000,
        });
        const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1000,
        });

        console.log(
          "[DEBUG][joinTable] program.programId:",
          program.programId.toBase58(),
        );
        console.log("[DEBUG][joinTable] table PDA:", tableAddress.toBase58());
        console.log("[DEBUG][joinTable] player PDA:", playerAddress.toBase58());
        console.log("[DEBUG][joinTable] signer:", publicKey.toBase58());
        console.log(
          "[DEBUG][joinTable] INCO_LIGHTNING_PROGRAM_ID:",
          INCO_LIGHTNING_PROGRAM_ID.toBase58(),
        );

        const txBuilder = (program.methods as any)
          .joinTable(tableId, characterId)
          .accounts({
            signer: publicKey,
            table: tableAddress,
            players: playerAddress,
            systemProgram: SystemProgram.programId,
            incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
          } as any)
          .preInstructions([computeUnitLimit, computeUnitPrice]);

        const transaction: Transaction = await txBuilder.transaction();
        // Log all instructions in the transaction to see which program IDs are used
        console.log("[DEBUG][joinTable] Transaction instructions:");
        transaction.instructions.forEach((ix, i) => {
          console.log(`  ix[${i}] programId: ${ix.programId.toBase58()}`);
          console.log(
            `  ix[${i}] keys:`,
            ix.keys.map((k) => ({
              pubkey: k.pubkey.toBase58(),
              isSigner: k.isSigner,
              isWritable: k.isWritable,
            })),
          );
        });
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        // Simulate first to get better error messages
        try {
          const simResult = await connection.simulateTransaction(transaction);
          if (simResult.value.err) {
            throw new Error(
              `Simulation failed: ${JSON.stringify(simResult.value.err)}\nLogs: ${simResult.value.logs?.join("\n")}`,
            );
          }
        } catch (simErr: any) {
          throw simErr;
        }

        // Sign with wallet, then send through our own RPC connection
        // (avoids Phantom's internal RPC which rate-limits on Chrome)
        const signed = await signTransaction!(transaction);
        const tx = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });

        await confirmWithTimeout(
          connection,
          tx,
          blockhash,
          lastValidBlockHeight,
        );

        await fetchTable();
        return true;
      } catch (err: any) {
        console.error("Error joining table:", err);
        setError(err.message || "Failed to join table");
        return false;
      } finally {
        setIsJoining(false);
      }
    },
    [
      connection,
      publicKey,
      anchorWallet,
      signTransaction,
      tableIdString,
      getTableAddress,
      fetchTable,
      tableData,
    ],
  );

  // Start round
  const startRound = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !anchorWallet || !sendTransaction) {
      setError("Wallet not connected");
      return false;
    }

    setIsStarting(true);
    setError(null);

    try {
      const provider = new AnchorProvider(connection, anchorWallet, {
        commitment: "confirmed",
      });
      const program = new Program(IDL as any, provider);

      const tableId = new BN(tableIdString);
      const tableAddress = getTableAddress();

      // Derive player PDA
      const [playerAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          tableId.toArrayLike(Buffer, "le", 16),
          publicKey.toBuffer(),
        ],
        PROGRAM_ID,
      );

      // Build compute budget instructions
      const computeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000,
      });
      const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1000,
      });

      const txBuilder = (program.methods as any)
        .startRound(tableId)
        .accounts({
          signer: publicKey,
          table: tableAddress,
          players: playerAddress,
          systemProgram: SystemProgram.programId,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
        } as any)
        .preInstructions([computeUnitLimit, computeUnitPrice]);

      const transaction: Transaction = await txBuilder.transaction();
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const tx = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });

      await confirmWithTimeout(connection, tx, blockhash, lastValidBlockHeight);

      await fetchTable();
      return true;
    } catch (err: any) {
      console.error("Error starting round:", err);
      setError(err.message || "Failed to start round");
      return false;
    } finally {
      setIsStarting(false);
    }
  }, [
    connection,
    publicKey,
    anchorWallet,
    sendTransaction,
    tableIdString,
    getTableAddress,
    fetchTable,
  ]);

  // Quit table
  const quitTable = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !anchorWallet || !sendTransaction) {
      setError("Wallet not connected");
      return false;
    }

    setIsQuitting(true);
    setError(null);

    try {
      const provider = new AnchorProvider(connection, anchorWallet, {
        commitment: "confirmed",
      });
      const program = new Program(IDL as any, provider);

      const tableId = new BN(tableIdString);
      const tableAddress = getTableAddress();

      // Derive player PDA
      const [playerAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          tableId.toArrayLike(Buffer, "le", 16),
          publicKey.toBuffer(),
        ],
        PROGRAM_ID,
      );

      // Build compute budget instructions
      const computeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({
        units: 200_000,
      });
      const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1000,
      });

      const txBuilder = (program.methods as any)
        .quitTable(tableId)
        .accounts({
          signer: publicKey,
          table: tableAddress,
          players: playerAddress,
          systemProgram: SystemProgram.programId,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
        } as any)
        .preInstructions([computeUnitLimit, computeUnitPrice]);

      const transaction: Transaction = await txBuilder.transaction();
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const tx = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });

      await confirmWithTimeout(connection, tx, blockhash, lastValidBlockHeight);

      return true;
    } catch (err: any) {
      console.error("Error quitting table:", err);
      setError(err.message || "Failed to quit table");
      return false;
    } finally {
      setIsQuitting(false);
    }
  }, [
    connection,
    publicKey,
    anchorWallet,
    sendTransaction,
    tableIdString,
    getTableAddress,
  ]);

  // Decrypt current player's cards
  // Full flow from working test: fetch player -> extract handles -> derive allowance PDAs -> grantCardAccess -> wait -> decrypt
  const decryptMyCards = useCallback(async (): Promise<DecryptedCard[]> => {
    if (
      !publicKey ||
      !signMessage ||
      !signTransaction ||
      !anchorWallet ||
      !sendTransaction
    ) {
      return [];
    }

    setIsDecryptingCards(true);

    try {
      const provider = new AnchorProvider(connection, anchorWallet, {
        commitment: "confirmed",
      });
      const program = new Program(IDL as any, provider);
      const tableId = new BN(tableIdString);

      const [playerAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          tableId.toArrayLike(Buffer, "le", 16),
          publicKey.toBuffer(),
        ],
        PROGRAM_ID,
      );

      // 1. Fetch player account to get encrypted card handles
      const player = await (program.account as any).player.fetch(playerAddress);
      if (!player.cards || player.cards.length === 0) {
        return [];
      }

      // Helper: derive allowance PDA from handle + allowed address
      function deriveAllowancePda(
        handle: bigint,
        allowedAddress: PublicKey,
      ): [PublicKey, number] {
        const handleBuffer = Buffer.alloc(16);
        let h = handle;
        for (let i = 0; i < 16; i++) {
          handleBuffer[i] = Number(h & BigInt(0xff));
          h = h >> BigInt(8);
        }
        return PublicKey.findProgramAddressSync(
          [handleBuffer, allowedAddress.toBuffer()],
          INCO_LIGHTNING_PROGRAM_ID,
        );
      }

      // 2. Derive allowance PDAs for each card's shape and value handles
      const remainingAccounts: AccountMeta[] = [];
      const handles: { shape: string; value: string }[] = [];

      for (const card of player.cards) {
        const shapeHandle = extractHandle(card.shape);
        const valueHandle = extractHandle(card.value);
        handles.push({
          shape: shapeHandle.toString(),
          value: valueHandle.toString(),
        });

        const [shapeAllowancePda] = deriveAllowancePda(shapeHandle, publicKey);
        const [valueAllowancePda] = deriveAllowancePda(valueHandle, publicKey);

        remainingAccounts.push(
          { pubkey: shapeAllowancePda, isSigner: false, isWritable: true },
          { pubkey: valueAllowancePda, isSigner: false, isWritable: true },
        );
      }

      // 3. Call grantCardAccess to allow our wallet to decrypt

      const computeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({
        units: 400_000,
      });
      const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1000,
      });

      const grantTxBuilder = (program.methods as any)
        .grantCardAccess(tableId)
        .accounts({
          signer: publicKey,
          player: playerAddress,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .remainingAccounts(remainingAccounts)
        .preInstructions([computeUnitLimit, computeUnitPrice]);

      const grantTx: Transaction = await grantTxBuilder.transaction();
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      grantTx.recentBlockhash = blockhash;
      grantTx.feePayer = publicKey;

      const signedGrantTx = await signTransaction!(grantTx);
      const grantSig = await connection.sendRawTransaction(
        signedGrantTx.serialize(),
        {
          skipPreflight: true,
          maxRetries: 5,
        },
      );

      await confirmWithTimeout(
        connection,
        grantSig,
        blockhash,
        lastValidBlockHeight,
      );

      // 4. Wait for TEE to process the allowances
      await new Promise((r) => setTimeout(r, 3000));

      // 5. Decrypt one card at a time, updating state after each
      const decryptedCards: DecryptedCard[] = [];
      for (let i = 0; i < handles.length; i++) {
        const result = await decrypt([handles[i].shape, handles[i].value], {
          address: publicKey,
          signMessage,
        });

        const shapeIdx = parseInt(result.plaintexts[0]);
        const valueIdx = parseInt(result.plaintexts[1]);
        const decryptedCard: DecryptedCard = {
          shape: shapeIdx,
          value: valueIdx,
        };
        decryptedCards.push(decryptedCard);

        // Store handle → decrypted mapping so placeCards can rebuild from on-chain state
        cardHandleMap.current.set(
          `${handles[i].shape}:${handles[i].value}`,
          decryptedCard,
        );

        // Update state immediately so UI reveals this card
        setMyCards((prev) => [...prev, decryptedCard]);
      }

      // Cache decrypted cards to localStorage
      saveCachedCards(
        tableIdString,
        publicKey.toString(),
        player.cards,
        decryptedCards,
      );

      return decryptedCards;
    } catch (err: any) {
      console.error("Error decrypting cards:", err);
      setDecryptFailed(true);
      return [];
    } finally {
      setIsDecryptingCards(false);
    }
  }, [
    publicKey,
    signMessage,
    signTransaction,
    anchorWallet,
    sendTransaction,
    connection,
    tableIdString,
  ]);

  // Shuffle cards with Inco allowance pattern:
  // 1. Simulate to extract handles
  // 2. Derive allowance PDAs from handles
  // 3. Execute real transaction with allowance PDAs as remaining_accounts
  const shuffleCards = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !anchorWallet || !sendTransaction) {
      return false;
    }

    // Prevent multiple simultaneous shuffle attempts (use ref to avoid stale closure)
    if (isShufflingRef.current) {
      return false;
    }

    isShufflingRef.current = true;
    setIsShuffling(true);

    try {
      const provider = new AnchorProvider(connection, anchorWallet, {
        commitment: "confirmed",
      });
      const program = new Program(IDL as any, provider);

      const tableAddress = getTableAddress();
      const tableId = new BN(tableIdString);

      // Derive player PDA
      const [playerAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          tableId.toArrayLike(Buffer, "le", 16),
          publicKey.toBuffer(),
        ],
        PROGRAM_ID,
      );

      // Build compute budget instructions
      const computeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({
        units: 400_000, // Higher for allow CPIs
      });
      const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1000,
      });

      // STEP 1: Simulate transaction to extract handles
      console.log(
        "[DEBUG][shuffleCards] program.programId:",
        program.programId.toBase58(),
      );
      console.log("[DEBUG][shuffleCards] table PDA:", tableAddress.toBase58());
      console.log(
        "[DEBUG][shuffleCards] player PDA:",
        playerAddress.toBase58(),
      );

      const simulateTxBuilder = (program.methods as any)
        .suffleCards(tableId)
        .accounts({
          signer: publicKey,
          table: tableAddress,
          players: playerAddress,
          systemProgram: SystemProgram.programId,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
        } as any)
        .preInstructions([computeUnitLimit, computeUnitPrice]);

      const simulateTx: Transaction = await simulateTxBuilder.transaction();
      const { blockhash: simBlockhash } =
        await connection.getLatestBlockhash("confirmed");
      simulateTx.recentBlockhash = simBlockhash;
      simulateTx.feePayer = publicKey;

      const simulation = await connection.simulateTransaction(simulateTx);

      // STEP 2: Parse handles and derive allowance PDAs
      const handles = parseHandlesFromSimulation(simulation.value);

      const remainingAccounts: AccountMeta[] = [];
      for (const handle of handles) {
        const allowancePDA = deriveAllowancePDAFromHandle(handle, publicKey);
        remainingAccounts.push({
          pubkey: allowancePDA,
          isSigner: false,
          isWritable: true,
        });
      }

      // STEP 3: Execute real transaction
      // NOTE: We skip remaining_accounts because e_rand generates different values each call,
      // so the PDAs from simulation won't match the actual execution.

      const txBuilder = (program.methods as any)
        .suffleCards(tableId)
        .accounts({
          signer: publicKey,
          table: tableAddress,
          players: playerAddress,
          systemProgram: SystemProgram.programId,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
        } as any)
        // .remainingAccounts(remainingAccounts) // Disabled - see note above
        .preInstructions([computeUnitLimit, computeUnitPrice]);

      const transaction: Transaction = await txBuilder.transaction();

      // Get fresh blockhash right before sending
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("finalized");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const tx = await sendTransaction(transaction, connection, {
        skipPreflight: true, // Skip preflight to speed up
        maxRetries: 5,
      });

      // Wait for confirmation
      const confirmation = await Promise.race([
        connection.confirmTransaction(
          { signature: tx, blockhash, lastValidBlockHeight },
          "confirmed",
        ),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Transaction timed out after 60s.")),
            60_000,
          ),
        ),
      ]);

      if (confirmation.value.err) {
        // Check if this is "not your turn" error (6002) - expected in multiplayer race conditions
        const errObj = confirmation.value.err as any;

        if (errObj?.InstructionError?.[1]?.Custom === 6002) {
          // Another player already shuffled (race condition), ignoring
        }
        return false;
      }

      await fetchTable(false);
      return true;
    } catch (err: any) {
      console.error("Error shuffling cards:", err);
      // If block height exceeded, the tx might still go through
      if (err.name === "TransactionExpiredBlockheightExceededError") {
        await fetchTable(false);
      }
      return false;
    } finally {
      isShufflingRef.current = false;
      setIsShuffling(false);
    }
  }, [
    connection,
    publicKey,
    anchorWallet,
    sendTransaction,
    tableIdString,
    getTableAddress,
    fetchTable,
  ]);

  // Place cards on the table (core gameplay action)
  const placeCards = useCallback(
    async (pickedIndices: number[]): Promise<boolean> => {
      if (!publicKey || !anchorWallet || !signTransaction) {
        setError("Wallet not connected");
        return false;
      }

      if (pickedIndices.length === 0) {
        setError("Select at least one card to play");
        return false;
      }

      // Guard: all players must finish shuffling before cards can be placed
      const playersCount = tableDataRef.current?.players.length ?? 0;
      if (playersCount > 0 && shuffleTurn >= 0 && shuffleTurn < playersCount) {
        setError("Waiting for all players to finish shuffling cards.");
        return false;
      }

      setIsPlacingCards(true);
      setError(null);

      try {
        const provider = new AnchorProvider(connection, anchorWallet, {
          commitment: "confirmed",
        });
        const program = new Program(IDL as any, provider);

        const tableId = new BN(tableIdString);
        const tableAddress = getTableAddress();

        const [playerAddress] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("player"),
            tableId.toArrayLike(Buffer, "le", 16),
            publicKey.toBuffer(),
          ],
          PROGRAM_ID,
        );

        // Pre-validate: ensure player has cards on-chain before sending tx
        const playerAccount = await (program.account as any).player.fetch(
          playerAddress,
        );
        if (!playerAccount.cards || playerAccount.cards.length === 0) {
          setError(
            "Your hand is empty — cards haven't been dealt yet. Please wait for the shuffle to complete.",
          );
          setMyCards([]);
          return false;
        }
        if (
          pickedIndices.length > playerAccount.cards.length ||
          pickedIndices.some((idx) => idx >= playerAccount.cards.length)
        ) {
          setError("Card selection is out of sync. Refreshing table data...");
          setMyCards([]);
          await fetchTable(false);
          return false;
        }

        const computeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({
          units: 300_000,
        });
        const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1000,
        });

        // Convert picked indices to bytes buffer
        const pickedIndexsBuffer = Buffer.from(pickedIndices);

        console.log(
          "[DEBUG][placeCards] program.programId:",
          program.programId.toBase58(),
        );
        console.log("[DEBUG][placeCards] table PDA:", tableAddress.toBase58());
        console.log(
          "[DEBUG][placeCards] player PDA:",
          playerAddress.toBase58(),
        );

        const txBuilder = (program.methods as any)
          .placeCards(tableId, pickedIndexsBuffer)
          .accounts({
            user: publicKey,
            table: tableAddress,
            player: playerAddress,
            systemProgram: SystemProgram.programId,
            incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
          } as any)
          .preInstructions([computeUnitLimit, computeUnitPrice]);

        const transaction: Transaction = await txBuilder.transaction();
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signed = await signTransaction!(transaction);
        const tx = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });

        await confirmWithTimeout(
          connection,
          tx,
          blockhash,
          lastValidBlockHeight,
        );

        // Pull fresh player account from chain and rebuild myCards from it
        const freshPlayer = await (program.account as any).player.fetch(
          playerAddress,
        );
        const freshMyCards: DecryptedCard[] = (freshPlayer.cards ?? [])
          .map((card: any) => {
            const key = `${extractHandle(card.shape)}:${extractHandle(card.value)}`;
            return cardHandleMap.current.get(key) ?? null;
          })
          .filter(Boolean) as DecryptedCard[];
        setMyCards(freshMyCards);

        await fetchTable(false);
        return true;
      } catch (err: any) {
        console.error("Error placing cards:", err);
        setError(err.message || "Failed to place cards");
        return false;
      } finally {
        setIsPlacingCards(false);
      }
    },
    [
      connection,
      publicKey,
      anchorWallet,
      signTransaction,
      tableIdString,
      getTableAddress,
      fetchTable,
      shuffleTurn,
    ],
  );

  // Call liar on the previous player (dedicated liarsCall instruction)
  const callLiar = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !anchorWallet || !signTransaction) {
      setError("Wallet not connected");
      return false;
    }

    setIsCallingLiar(true);
    setError(null);

    try {
      const provider = new AnchorProvider(connection, anchorWallet, {
        commitment: "confirmed",
      });
      const program = new Program(IDL as any, provider);

      const tableId = new BN(tableIdString);
      const tableAddress = getTableAddress();

      const [playerAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          tableId.toArrayLike(Buffer, "le", 16),
          publicKey.toBuffer(),
        ],
        PROGRAM_ID,
      );

      const computeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000,
      });
      const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1000,
      });

      const txBuilder = (program.methods as any)
        .liarsCall(tableId)
        .accounts({
          signer: publicKey,
          table: tableAddress,
          players: playerAddress,
          systemProgram: SystemProgram.programId,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
        } as any)
        .preInstructions([computeUnitLimit, computeUnitPrice]);

      const transaction: Transaction = await txBuilder.transaction();
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signed = await signTransaction!(transaction);
      const tx = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      await confirmWithTimeout(connection, tx, blockhash, lastValidBlockHeight);

      await fetchTable(false);
      return true;
    } catch (err: any) {
      console.error("Error calling liar:", err);
      setError(err.message || "Failed to call liar");
      return false;
    } finally {
      setIsCallingLiar(false);
    }
  }, [
    connection,
    publicKey,
    anchorWallet,
    signTransaction,
    tableIdString,
    getTableAddress,
    fetchTable,
  ]);

  // Helper to add event to log
  const addEventLog = useCallback(
    (type: string, message: string, player?: string) => {
      setEventLog((prev) => [
        ...prev.slice(-49),
        {
          // Keep last 50 events
          type,
          player,
          timestamp: Date.now(),
          message,
        },
      ]);
    },
    [],
  );

  // Helper to get short address for display
  const shortenAddress = (address: string) =>
    `${address.slice(0, 4)}...${address.slice(-4)}`;

  // ── Unified event handler ─────────────────────────────────────
  // Called by useGameEvents when Anchor addEventListener fires.
  // Updates the UI-driving state directly (gameState, currentTurnPlayer, etc.)
  const handleGameEvent = useCallback(
    (event: import("./gameTypes").GameEventPayload) => {
      console.log("[WS][useTable] Event received:", event.type, event);

      switch (event.type) {
        case "playerJoined": {
          addEventLog(
            "playerJoined",
            `${shortenAddress(event.player)} joined the table`,
            event.player,
          );
          debouncedFetchTable();
          break;
        }

        case "roundStarted": {
          setGameState("playing");
          setMyCards([]);
          setDecryptFailed(false);
          setLiarCaller(null);
          setLastClaimBy(null);
          // Clear cached cards — new round means new encrypted cards
          if (publicKey) {
            clearCardCache(tableIdString, publicKey.toString());
          }
          addEventLog("roundStarted", "Round started!");
          debouncedFetchTable();
          break;
        }

        case "tableTrun": {
          setCurrentTurnPlayer(event.player);
          addEventLog(
            "tableTrun",
            `It's ${shortenAddress(event.player)}'s turn`,
            event.player,
          );
          debouncedFetchTable();
          break;
        }

        case "cardPlaced": {
          setLastClaimBy(event.player);
          addEventLog(
            "cardPlaced",
            `${shortenAddress(event.player)} placed a card`,
            event.player,
          );
          debouncedFetchTable();
          break;
        }

        case "liarCalled": {
          setLiarCaller(event.caller);
          addEventLog(
            "liarCalled",
            `${shortenAddress(event.caller)} called LIAR!`,
            event.caller,
          );
          debouncedFetchTable();
          break;
        }

        case "playerEleminated": {
          addEventLog(
            "playerEleminated",
            `${shortenAddress(event.player)} was eliminated!`,
            event.player,
          );
          debouncedFetchTable();
          break;
        }

        case "suffleCardsForPlayer": {
          addEventLog(
            "suffleCardsForPlayer",
            `Cards shuffled for ${shortenAddress(event.player)}, next: ${shortenAddress(event.next)}`,
            event.player,
          );
          setCurrentTurnPlayer(event.next);
          debouncedFetchTable();
          break;
        }

        case "emptyBulletFired": {
          addEventLog(
            "emptyBulletFired",
            `${shortenAddress(event.player)} fired an empty bullet - safe!`,
            event.player,
          );
          debouncedFetchTable();
          break;
        }

        case "liarsTableCreated": {
          addEventLog("liarsTableCreated", "Table created");
          debouncedFetchTable();
          break;
        }

        case "gameOver": {
          setIsOver(true);
          setGameState("ended");
          addEventLog("gameOver", "Game over!");
          debouncedFetchTable();
          break;
        }

        case "gameWinner": {
          addEventLog(
            "gameWinner",
            `${shortenAddress(event.player)} wins the game!`,
            event.player,
          );
          debouncedFetchTable();
          break;
        }
      }
    },
    [debouncedFetchTable, addEventLog],
  );

  // Stable ref for the event handler (avoids re-creating addEventListener subscriptions)
  const handleGameEventRef = useRef(handleGameEvent);
  handleGameEventRef.current = handleGameEvent;

  // ── Account change subscription (for table data updates) ────
  const handleAccountChange = useCallback(() => {
    fetchTable(false);
  }, [fetchTable]);

  // Keep the account change subscription from the old system (it's lightweight)
  useTableSubscription({
    tableIdString,
    onAccountChange: handleAccountChange,
  });

  // ── Anchor addEventListener-based event system (single source of truth) ──
  const { eventLog: wsEventLog, activeAnimation: wsAnimation } = useGameEvents({
    tableId: tableIdString,
    onRefetchTable: () => debouncedFetchTable(),
    onGameEvent: (event) => handleGameEventRef.current(event),
    onCardsShuffled: (_next) => {
      // Cards were shuffled for our wallet — decrypt flow handled by auto-decrypt effect
    },
  });

  // WebSocket connection health monitor
  const { status: connectionStatus } = useConnectionStatus();

  // Sync animation state from useGameEvents
  useEffect(() => {
    if (wsAnimation) {
      setActiveAnimation(wsAnimation);
    }
  }, [wsAnimation]);

  // Fetch on mount and when wallet connects/changes
  useEffect(() => {
    if (!anchorWallet) {
      // Wait for wallet to be connected
      return;
    }

    const currentWalletKey = anchorWallet.publicKey.toString();

    // Fetch if this is the first fetch or wallet changed
    if (
      !initialFetchDone.current ||
      lastWalletKey.current !== currentWalletKey
    ) {
      initialFetchDone.current = true;
      lastWalletKey.current = currentWalletKey;
      fetchTable(true);
    }
  }, [fetchTable, anchorWallet]);

  const isPlayerInTable =
    publicKey && tableData?.players.includes(publicKey.toString());
  const canStart =
    isPlayerInTable &&
    tableData &&
    tableData.players.length >= 2 &&
    tableData.isOpen;

  // Check if it's the current user's turn
  const isMyTurn = publicKey && currentTurnPlayer === publicKey.toString();

  // Check if the current user should see the shuffle button
  // Only show if:
  // - shuffleTurn >= 0 (not -1 which means no shuffle needed)
  // - shuffleTurn < players.length (valid index)
  // - user is at players[shuffleTurn]
  const myPlayerIndex =
    publicKey && tableData
      ? tableData.players.findIndex((p) => p === publicKey.toString())
      : -1;
  const playersCount = tableData?.players.length ?? 0;
  const shouldShowShuffleButton =
    shuffleTurn >= 0 &&
    shuffleTurn < playersCount &&
    myPlayerIndex >= 0 &&
    myPlayerIndex === shuffleTurn;

  // Get list of taken character IDs
  const takenCharacters =
    tableData?.playerInfos
      .filter((p) => p.characterId !== null)
      .map((p) => p.characterId as string) || [];

  // Get current player's encrypted cards
  const myEncryptedCards = publicKey
    ? tableData?.playerInfos.find((p) => p.address === publicKey.toString())
        ?.encryptedCards || []
    : [];

  // ── Clear stale myCards when on-chain cards are gone ─────────
  // Handles race conditions where roundStarted fires mid-decryption
  // or cache outlives its on-chain counterpart.
  useEffect(() => {
    if (gameState !== "playing") return;
    if (
      myEncryptedCards.length === 0 &&
      myCards.length > 0 &&
      !isDecryptingCards
    ) {
      setMyCards([]);
    }
  }, [gameState, myEncryptedCards.length, myCards.length, isDecryptingCards]);

  // ── Load cached decrypted cards or trigger decrypt ───────────
  useEffect(() => {
    if (!publicKey || myEncryptedCards.length === 0 || myCards.length > 0)
      return;
    if (isDecryptingCards || decryptFailed) return;
    if (gameState !== "playing") return;

    const cached = loadCachedCards(
      tableIdString,
      publicKey.toString(),
      myEncryptedCards,
    );
    if (cached) {
      setMyCards(cached);
    } else {
      // Not in cache — trigger decryption
      decryptMyCards();
    }
  }, [
    publicKey,
    tableIdString,
    myEncryptedCards,
    myCards.length,
    gameState,
    isDecryptingCards,
    decryptFailed,
    decryptMyCards,
  ]);

  return {
    // Table data
    tableData,
    isLoading,
    error,

    // Game state
    gameState,
    currentTurnPlayer,
    isMyTurn,
    eventLog,
    lastClaimBy,
    liarCaller,
    isOver,

    // Player state
    isPlayerInTable,
    canStart,
    takenCharacters,

    // Shuffle state
    shuffleTurn,
    shouldShowShuffleButton,

    // Cards
    myCards,
    myEncryptedCards,
    decryptMyCards,
    isDecryptingCards,
    decryptFailed,

    // Actions
    joinTable,
    startRound,
    quitTable,
    shuffleCards,
    placeCards,
    callLiar,
    fetchTable,

    // Action states
    isJoining,
    isStarting,
    isQuitting,
    isShuffling,
    isPlacingCards,
    isCallingLiar,

    // WebSocket event system
    wsEventLog,
    activeAnimation,
    connectionStatus,
  };
}

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
import { useTableSubscription, GameEvent } from "./useTableSubscription";
import { PROGRAM_ID, INCO_LIGHTNING_PROGRAM_ID } from "./config";
import { decrypt } from "@inco/solana-sdk";
import type {
  AccountMeta,
  SimulatedTransactionResponse,
} from "@solana/web3.js";

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

  console.log("=== Parsing simulation for handles ===");

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
          console.log(
            `Found handle in result= log: ${handleValue.toString(16).padStart(32, "0")}`,
          );
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
        console.log(`Found potential handle in hex log: ${handleHex}`);
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
      console.log("Return data buffer length:", buffer.length);

      // Each handle is 16 bytes (u128) in little-endian
      for (let i = 0; i + 16 <= buffer.length; i += 16) {
        let handleValue = BigInt(0);
        for (let j = 0; j < 16; j++) {
          handleValue |= BigInt(buffer[i + j]) << BigInt(j * 8);
        }
        if (handleValue !== BigInt(0)) {
          handles.push(handleValue);
          console.log(
            `Found handle in return data: ${handleValue.toString(16)}`,
          );
        }
      }
    } catch (e) {
      console.log("Failed to parse returnData:", e);
    }
  }

  // Deduplicate
  const uniqueHandles = [...new Set(handles.map((h) => h.toString()))].map(
    (s) => BigInt(s),
  );
  console.log(`Total unique handles found: ${uniqueHandles.length}`);
  return uniqueHandles;
}

// Decrypted card for display
export interface DecryptedCard {
  shape: number; // 0-3 for suits
  value: number; // 1-13 for card values
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
  const [lastEvent, setLastEvent] = useState<GameEvent | null>(null);
  const [eventLog, setEventLog] = useState<GameEventLog[]>([]);
  const [shuffleTurn, setShuffleTurn] = useState<number>(-1); // -1 means no one should shuffle

  // Card decryption state
  const [myCards, setMyCards] = useState<DecryptedCard[]>([]);
  const [isDecryptingCards, setIsDecryptingCards] = useState(false);
  const [decryptFailed, setDecryptFailed] = useState(false);
  const { signMessage } = useWallet();

  // Derive table PDA
  const getTableAddress = useCallback(() => {
    const tableId = new BN(tableIdString);
    const [tableAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("table"), tableId.toArrayLike(Buffer, "le", 16)],
      PROGRAM_ID,
    );
    return tableAddress;
  }, [tableIdString]);

  // Track if initial fetch is done for the current wallet
  const initialFetchDone = useRef(false);
  const lastWalletKey = useRef<string | null>(null);

  // Ref to track if shuffle is in progress (avoids stale closure issues)
  const isShufflingRef = useRef(false);

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
        };
        tableDataRef.current = newTableData;
        setTableData(newTableData);

        // Update shuffle turn from chain data
        const chainShuffleTurn =
          typeof table.suffleTrun === "number" ? table.suffleTrun : -1;
        setShuffleTurn(chainShuffleTurn);

        // Update game state based on table status
        if (table.isOpen) {
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

        // Build compute budget instructions
        const computeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({
          units: 200_000,
        });
        const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1000,
        });

        console.log("Building joinTable transaction...");
        console.log("Table ID:", tableId.toString());
        console.log("Character ID:", characterId);
        console.log("Table Address:", tableAddress.toString());
        console.log("Player Address:", playerAddress.toString());
        console.log("Signer:", publicKey.toString());

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
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        // Simulate first to get better error messages
        console.log("Simulating transaction...");
        try {
          const simResult = await connection.simulateTransaction(transaction);
          if (simResult.value.err) {
            console.error("Simulation error:", simResult.value.err);
            console.error("Simulation logs:", simResult.value.logs);
            throw new Error(
              `Simulation failed: ${JSON.stringify(simResult.value.err)}\nLogs: ${simResult.value.logs?.join("\n")}`,
            );
          }
          console.log("Simulation successful");
        } catch (simErr: any) {
          console.error("Simulation failed:", simErr);
          throw simErr;
        }

        // Sign with wallet, then send through our own RPC connection
        // (avoids Phantom's internal RPC which rate-limits on Chrome)
        const signed = await signTransaction!(transaction);
        const tx = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });

        await connection.confirmTransaction(
          {
            signature: tx,
            blockhash,
            lastValidBlockHeight,
          },
          "confirmed",
        );

        console.log("Joined table! Tx:", tx);
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

      await connection.confirmTransaction(
        {
          signature: tx,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      console.log("Round started! Tx:", tx);
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

      console.log("Building quitTable transaction...");

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

      await connection.confirmTransaction(
        {
          signature: tx,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      console.log("Quit table! Tx:", tx);
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
    if (!publicKey || !signMessage || !signTransaction || !anchorWallet || !sendTransaction) {
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
      console.log("Player has", player.cards.length, "encrypted cards");

      if (!player.cards || player.cards.length === 0) {
        console.log("No cards found in player account");
        return [];
      }

      // Helper: extract u128 handle from Anchor-deserialized Euint128 tuple struct
      function extractHandle(euint128: any): bigint {
        if (euint128 && euint128._bn) return BigInt(euint128.toString());
        if (euint128 && euint128["0"]) return BigInt(euint128["0"].toString());
        if (Array.isArray(euint128) && euint128.length > 0)
          return BigInt(euint128[0].toString());
        return BigInt(0);
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

      console.log("Card handles:", handles);

      // 3. Call grantCardAccess to allow our wallet to decrypt
      console.log("Granting card access with", remainingAccounts.length, "allowance accounts...");

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
      const grantSig = await connection.sendRawTransaction(signedGrantTx.serialize(), {
        skipPreflight: true,
        maxRetries: 5,
      });

      console.log("Grant card access tx:", grantSig);

      await connection.confirmTransaction(
        { signature: grantSig, blockhash, lastValidBlockHeight },
        "confirmed",
      );

      console.log("Card access granted! Waiting for TEE to process...");

      // 4. Wait for TEE to process the allowances
      await new Promise((r) => setTimeout(r, 3000));

      // 5. Decrypt one card at a time, updating state after each
      const shapes = ["Spades", "Hearts", "Diamonds", "Clubs"];
      const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

      for (let i = 0; i < handles.length; i++) {
        console.log(`Decrypting card ${i + 1}/${handles.length}...`);
        const result = await decrypt([handles[i].shape, handles[i].value], {
          address: publicKey,
          signMessage,
        });

        const shapeIdx = parseInt(result.plaintexts[0]);
        const valueIdx = parseInt(result.plaintexts[1]);

        console.log(
          `Card ${i + 1}: ${values[valueIdx] ?? valueIdx} of ${shapes[shapeIdx] ?? shapeIdx}`,
        );

        // Update state immediately so UI reveals this card
        setMyCards((prev) => [...prev, { shape: shapeIdx, value: valueIdx }]);
      }

      console.log("All cards decrypted");
      return myCards;
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
      console.log("Cannot shuffle: wallet not connected");
      return false;
    }

    // Prevent multiple simultaneous shuffle attempts (use ref to avoid stale closure)
    if (isShufflingRef.current) {
      console.log("Already shuffling, skipping...");
      return false;
    }

    isShufflingRef.current = true;
    setIsShuffling(true);

    try {
      const provider = new AnchorProvider(connection, anchorWallet, {
        commitment: "confirmed",
      });
      const program = new Program(IDL as any, provider);

      // Log table account data before shuffling
      const tableAddress = getTableAddress();
      const tableAccount = await (program.account as any).liarsTable.fetch(
        tableAddress,
      );
      console.log("=== Table Account Data (before shuffle) ===");
      console.log("Table ID:", tableAccount.tableId.toString());
      console.log(
        "Players:",
        tableAccount.players.map((p: PublicKey) => p.toString()),
      );
      console.log("Is Open:", tableAccount.isOpen);
      console.log("Table Card:", tableAccount.tableCard);
      console.log("Turn to Play:", tableAccount.trunToPlay);
      console.log("Shuffle Turn:", tableAccount.suffleTrun);
      console.log("==========================================");

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
      console.log("=== STEP 1: Simulating to extract handles ===");

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
      console.log("Simulation logs:", simulation.value.logs);

      // STEP 2: Parse handles and derive allowance PDAs
      console.log("=== STEP 2: Deriving allowance PDAs ===");
      const handles = parseHandlesFromSimulation(simulation.value);

      const remainingAccounts: AccountMeta[] = [];
      for (const handle of handles) {
        const allowancePDA = deriveAllowancePDAFromHandle(handle, publicKey);
        console.log(
          `Handle (dec): ${handle.toString()} -> (hex): ${handle.toString(16).padStart(32, "0")} -> PDA: ${allowancePDA.toString()}`,
        );
        remainingAccounts.push({
          pubkey: allowancePDA,
          isSigner: false,
          isWritable: true,
        });
      }

      // STEP 3: Execute real transaction
      // NOTE: We skip remaining_accounts because e_rand generates different values each call,
      // so the PDAs from simulation won't match the actual execution.
      // The Rust program should either:
      // - Not require allowance accounts during shuffle (handle allow separately)
      // - Use a deterministic seed for randomness
      console.log(
        `=== STEP 3: Executing shuffle (without allowance accounts - see note) ===`,
      );
      console.log(
        `(Skipping ${remainingAccounts.length} allowance accounts from simulation - random values differ per execution)`,
      );

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

      console.log("Sending shuffle transaction with allowance accounts...");

      const tx = await sendTransaction(transaction, connection, {
        skipPreflight: true, // Skip preflight to speed up
        maxRetries: 5,
      });

      console.log("Shuffle transaction sent:", tx);

      // Use a longer timeout for confirmation
      const confirmation = await connection.confirmTransaction(
        {
          signature: tx,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      if (confirmation.value.err) {
        // Check if this is "not your turn" error (6002) - expected in multiplayer race conditions
        const errObj = confirmation.value.err as any;
        console.error(
          "Shuffle transaction failed with error:",
          JSON.stringify(confirmation.value.err, null, 2),
        );

        // Try to get more details from the transaction
        try {
          const txDetails = await connection.getTransaction(tx, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          });
          console.error("Transaction logs:", txDetails?.meta?.logMessages);
        } catch (e) {
          console.error("Could not fetch transaction details:", e);
        }

        if (errObj?.InstructionError?.[1]?.Custom === 6002) {
          console.log(
            "Another player already shuffled (race condition), ignoring...",
          );
        }
        return false;
      }

      console.log("Cards shuffled! Tx:", tx);
      await fetchTable(false);

      // Log raw encrypted card data after shuffle
      const playerAccount = await (program.account as any).player.fetch(
        playerAddress,
      );
      console.log("=== Raw Encrypted Card Data ===");
      console.log("Player PDA:", playerAddress.toString());
      console.log("Number of cards:", playerAccount.cards?.length || 0);
      console.log("Raw cards data:", playerAccount.cards);
      if (playerAccount.cards) {
        playerAccount.cards.forEach((card: any, index: number) => {
          console.log(`Card ${index}:`, {
            shape: card.shape,
            value: card.value,
          });
        });
      }
      console.log("===============================");

      return true;
    } catch (err: any) {
      console.error("Error shuffling cards:", err);
      // If block height exceeded, the tx might still go through
      if (err.name === "TransactionExpiredBlockheightExceededError") {
        console.log(
          "Transaction may have succeeded despite timeout, refetching table...",
        );
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

  // Handle WebSocket events
  const handleEvent = useCallback(
    (event: GameEvent) => {
      console.log("Received game event:", event);
      setLastEvent(event);

      // Check if this event is for our table
      if (event.data.tableId !== tableIdString) {
        return;
      }

      switch (event.type) {
        case "playerJoined": {
          const playerAddr = event.data.player;
          addEventLog(
            "playerJoined",
            `${shortenAddress(playerAddr)} joined the table`,
            playerAddr,
          );
          // Refetch to get updated player list
          fetchTable(false);
          break;
        }

        case "roundStarted": {
          setGameState("playing");
          addEventLog("roundStarted", "Round started!");
          // Fetch fresh table data - shuffleTurn will be updated automatically
          // User must manually click shuffle button if it's their turn
          fetchTable(false);
          break;
        }

        case "tableTrun": {
          const playerAddr = event.data.player;
          setCurrentTurnPlayer(playerAddr);
          addEventLog(
            "tableTrun",
            `It's ${shortenAddress(playerAddr)}'s turn`,
            playerAddr,
          );
          fetchTable(false);
          break;
        }

        case "cardPlaced": {
          const playerAddr = event.data.player;
          addEventLog(
            "cardPlaced",
            `${shortenAddress(playerAddr)} placed a card`,
            playerAddr,
          );
          fetchTable(false);
          break;
        }

        case "liarCalled": {
          const callerAddr = event.data.caller;
          addEventLog(
            "liarCalled",
            `${shortenAddress(callerAddr)} called LIAR!`,
            callerAddr,
          );
          fetchTable(false);
          break;
        }

        case "playerEleminated": {
          const playerAddr = event.data.player;
          addEventLog(
            "playerEleminated",
            `${shortenAddress(playerAddr)} was eliminated!`,
            playerAddr,
          );
          fetchTable(false);
          break;
        }

        case "suffleCardsForPlayer": {
          const playerAddr = event.data.player;
          const nextAddr = event.data.next;
          addEventLog(
            "suffleCardsForPlayer",
            `Cards shuffled for ${shortenAddress(playerAddr)}, next: ${shortenAddress(nextAddr)}`,
            playerAddr,
          );
          setCurrentTurnPlayer(nextAddr);
          // Fetch fresh table data - shuffleTurn will be updated automatically
          // User must manually click shuffle button if it's their turn
          fetchTable(false);
          break;
        }

        case "emptyBulletFired": {
          const playerAddr = event.data.player;
          addEventLog(
            "emptyBulletFired",
            `${shortenAddress(playerAddr)} fired an empty bullet - safe!`,
            playerAddr,
          );
          fetchTable(false);
          break;
        }

        default:
          // For any other events, just refetch
          fetchTable(false);
      }
    },
    [fetchTable, tableIdString, addEventLog],
  );

  // Handle account changes via WebSocket
  const handleAccountChange = useCallback(() => {
    console.log("Table account changed, refetching...");
    fetchTable(false);
  }, [fetchTable]);

  // Subscribe to WebSocket events and account changes
  useTableSubscription({
    tableIdString,
    onEvent: handleEvent,
    onAccountChange: handleAccountChange,
  });

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

  return {
    // Table data
    tableData,
    isLoading,
    error,

    // Game state
    gameState,
    currentTurnPlayer,
    isMyTurn,
    lastEvent,
    eventLog,

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
    fetchTable,

    // Action states
    isJoining,
    isStarting,
    isQuitting,
    isShuffling,
  };
}

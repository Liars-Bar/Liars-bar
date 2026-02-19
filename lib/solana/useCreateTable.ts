import { useCallback, useState, useEffect, useRef } from "react";
import {
  useConnection,
  useWallet,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, ComputeBudgetProgram, Transaction } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { IDL } from "./idl";
import { PROGRAM_ID, INCO_LIGHTNING_PROGRAM_ID } from "./config";

/**
 * Generate a random u128 table ID from UUID
 */
function generateTableId(): BN {
  const uuid = crypto.randomUUID().replace(/-/g, "");
  // Use full 32 hex chars (16 bytes = 128 bits) for u128
  return new BN(uuid, 16);
}

/**
 * Hook for creating a new Liar's Bar game table
 *
 * ## How Inco's e_rand is used for random number generation:
 *
 * When `createTable` is called, the Solana program internally uses Inco Lightning's
 * `e_rand` function via CPI (Cross-Program Invocation) to generate encrypted random
 * numbers for:
 *
 * 1. **Card Shuffling** - Encrypted random values determine card distribution
 * 2. **Bullet Position** - Random placement in the revolver (hidden from players)
 * 3. **Turn Order** - Random initial player selection
 *
 * ### On-chain flow (Rust):
 * ```rust
 * // In the Solana program's create_table instruction:
 * use inco_lightning::cpi::e_rand;
 * use inco_lightning::types::Euint128;
 *
 * // Generate encrypted random number via CPI
 * let cpi_ctx = CpiContext::new(
 *     ctx.accounts.inco_lightning_program.to_account_info(),
 *     Operation { signer: ctx.accounts.signer.to_account_info() },
 * );
 * let random_value: Euint128 = e_rand(cpi_ctx, 0)?;
 *
 * // Store in table account - value is encrypted until authorized decryption
 * ctx.accounts.table.random_seed = random_value;
 * ```
 *
 * ### Security Properties:
 * - **Unpredictable**: Random values cannot be predicted before generation
 * - **Encrypted**: Results are encrypted, only visible to authorized parties
 * - **Verifiable**: Decryption requires attestation from the covalidator network
 *
 * ### Frontend Decryption (when authorized):
 * ```typescript
 * import { useIncoRandom } from './useIncoRandom';
 *
 * const { decryptRandomValue } = useIncoRandom();
 * const result = await decryptRandomValue(encryptedHandle);
 * ```
 *
 * @param onTableCreated - Callback fired when table is successfully created
 * @returns Hook state and createTable function
 *
 * @see https://docs.inco.org/svm/guide/random - Inco random number documentation
 */
export function useCreateTable(onTableCreated?: (tableId: string) => void) {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onTableCreatedRef = useRef(onTableCreated);

  // Keep callback ref updated
  useEffect(() => {
    onTableCreatedRef.current = onTableCreated;
  }, [onTableCreated]);

  const createTable = useCallback(async (): Promise<{
    tableId: BN;
    txSignature: string;
  } | null> => {
    if (!publicKey || !anchorWallet) {
      setError("Wallet not connected");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create provider
      const provider = new AnchorProvider(connection, anchorWallet, {
        commitment: "confirmed",
      });

      // Create program instance
      const program = new Program(IDL as any, provider);

      // Generate random table ID
      const tableId = generateTableId();

      // Derive table PDA (using 16 bytes for u128)
      const [tableAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("table"), tableId.toArrayLike(Buffer, "le", 16)],
        PROGRAM_ID,
      );

      console.log("Creating table with ID:", tableId.toString());
      console.log("Table PDA:", tableAddress.toString());
      console.log("Program ID:", PROGRAM_ID.toString());
      console.log("Inco Lightning Program ID:", INCO_LIGHTNING_PROGRAM_ID.toString());
      console.log("Signer:", publicKey.toString());

      // Check if program exists
      const programInfo = await connection.getAccountInfo(PROGRAM_ID);
      if (!programInfo) {
        throw new Error(`Program ${PROGRAM_ID.toString()} not found on this network. Is it deployed?`);
      }
      console.log("Program found, executable:", programInfo.executable);

      // Check wallet balance
      const balance = await connection.getBalance(publicKey);
      console.log("Wallet balance:", balance / 1e9, "SOL");
      if (balance < 0.01 * 1e9) {
        throw new Error("Insufficient SOL balance. Need at least 0.01 SOL.");
      }

      // Build compute budget instructions
      const computeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({
        units: 200_000,
      });
      const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1000,
      });

      // Build transaction
      const txBuilder = (program.methods as any)
        .createTable(tableId)
        .accounts({
          signer: publicKey,
          table: tableAddress,
          systemProgram: SystemProgram.programId,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
        } as any)
        .preInstructions([computeUnitLimit, computeUnitPrice]);

      // Build the transaction manually
      console.log("Building transaction...");
      const transaction: Transaction = await txBuilder.transaction();

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Simulate first to get better errors
      console.log("Simulating transaction...");
      try {
        const simResult = await connection.simulateTransaction(transaction);
        console.log("Simulation result:", simResult);
        if (simResult.value.err) {
          console.error("Simulation error:", simResult.value.err);
          console.error("Simulation logs:", simResult.value.logs);
          throw new Error(`Simulation failed: ${JSON.stringify(simResult.value.err)}`);
        }
        console.log("Simulation successful");
      } catch (simErr: any) {
        console.error("Simulation failed:", simErr);
        throw simErr;
      }

      // Set up event listener before sending transaction
      console.log("Setting up event listener...");
      let eventListenerId: number | null = null;

      eventListenerId = program.addEventListener("liarsTableCreated", (event: any, slot, signature) => {
        console.log("liarsTableCreated event received:", event.tableId.toString());
        console.log("Event slot:", slot, "signature:", signature);
      });

      // Send transaction using wallet adapter's sendTransaction
      console.log("Sending transaction via wallet adapter...");
      const tx = await sendTransaction(transaction, connection, {
        skipPreflight: true, // Already simulated above
        maxRetries: 5,
      });

      console.log("Transaction sent:", tx);

      // Wait for confirmation with a timeout fallback
      console.log("Waiting for confirmation...");
      const confirmPromise = connection.confirmTransaction({
        signature: tx,
        blockhash,
        lastValidBlockHeight,
      }, "confirmed");

      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 30000)
      );

      const confirmation = await Promise.race([confirmPromise, timeoutPromise]);

      if (confirmation === null) {
        // Timeout - check signature status manually
        console.log("Confirmation timed out, checking signature status...");
        const status = await connection.getSignatureStatus(tx);
        if (status?.value?.err) {
          if (eventListenerId !== null) {
            program.removeEventListener(eventListenerId);
          }
          throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }
        if (status?.value?.confirmationStatus === "confirmed" || status?.value?.confirmationStatus === "finalized") {
          console.log("Transaction confirmed via status check!");
        } else {
          console.log("Transaction status:", status?.value?.confirmationStatus ?? "unknown", "- proceeding optimistically");
        }
      } else if (confirmation.value.err) {
        if (eventListenerId !== null) {
          program.removeEventListener(eventListenerId);
        }
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      } else {
        console.log("Transaction confirmed!");
      }

      // Don't block on event - use the table ID we already know
      // Clean up event listener
      if (eventListenerId !== null) {
        program.removeEventListener(eventListenerId);
      }

      const createdTableId = tableId.toString();
      console.log("Table created with ID:", createdTableId);

      // Call the callback if provided
      if (onTableCreatedRef.current) {
        onTableCreatedRef.current(createdTableId);
      }

      return { tableId, txSignature: tx };
    } catch (err: any) {
      console.error("=== Error creating table ===");
      console.error("Error:", err);

      // Log program logs if available
      if (err?.logs) {
        console.error("Program logs:", err.logs);
      }

      // Log simulation response
      if (err?.simulationResponse) {
        console.error("Simulation response:", JSON.stringify(err.simulationResponse, null, 2));
      }

      // Extract error message
      let errorMessage = "Failed to create table";

      // Check for wallet-specific errors
      if (err?.name === "WalletSignTransactionError") {
        if (err?.message?.includes("User rejected")) {
          errorMessage = "Transaction was rejected by user";
        } else if (err?.message?.includes("Internal JSON-RPC error")) {
          errorMessage = "Wallet RPC error - please try reconnecting your wallet or switching RPC endpoint";
        } else {
          errorMessage = `Wallet error: ${err.message}`;
        }
      } else if (err?.logs?.length > 0) {
        const relevantLog = err.logs.find((log: string) =>
          log.includes("Error") || log.includes("failed")
        );
        errorMessage = relevantLog || err.logs[err.logs.length - 1];
      } else if (err?.message) {
        errorMessage = err.message;
      }

      // Log additional details for debugging
      console.error("Error name:", err?.name);
      console.error("Error code:", err?.code);

      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [connection, publicKey, anchorWallet, sendTransaction]);

  return {
    createTable,
    isLoading,
    error,
    isWalletConnected: connected && !!publicKey,
  };
}

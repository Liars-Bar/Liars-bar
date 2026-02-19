import { PublicKey } from "@solana/web3.js";

// Program IDs - Update these with your actual program IDs
// Using valid devnet placeholder addresses for now
export const PROGRAM_ID_STRING = "F618XAoLrCWU7vx5ccd9HB1x85ttjqWwb77FG4TSVWE6"; // Replace with your actual program ID
export const INCO_LIGHTNING_PROGRAM_ID_STRING =
  "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"; // Replace with your actual Inco Lightning program ID

export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);
export const INCO_LIGHTNING_PROGRAM_ID = new PublicKey(
  INCO_LIGHTNING_PROGRAM_ID_STRING,
);

// Solana cluster configuration
export const SOLANA_RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com";
export const SOLANA_WS_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_WS_ENDPOINT || "wss://api.devnet.solana.com";

// Derive allowance PDA for Inco Lightning
// Seeds: [handle (16 bytes LE), allowed_address (32 bytes)]
export function deriveAllowancePDA(
  handle: bigint | string,
  allowedAddress: PublicKey
): [PublicKey, number] {
  // Convert handle to 16-byte little-endian buffer
  let handleBigInt: bigint;
  if (typeof handle === "string") {
    // Remove 0x prefix if present
    const cleanHandle = handle.startsWith("0x") ? handle.slice(2) : handle;
    handleBigInt = BigInt("0x" + cleanHandle);
  } else {
    handleBigInt = handle;
  }

  const handleBuffer = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    handleBuffer[i] = Number((handleBigInt >> BigInt(i * 8)) & BigInt(0xff));
  }

  return PublicKey.findProgramAddressSync(
    [handleBuffer, allowedAddress.toBuffer()],
    INCO_LIGHTNING_PROGRAM_ID
  );
}

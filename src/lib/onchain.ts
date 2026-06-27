/**
 * src/lib/onchain.ts
 *
 * Unified on-chain verification for all payment write paths.
 *
 * Both /api/transfers and /api/sessions/[code]/pay must call
 * verifyUsdcTransfer() before touching the database. This ensures
 * the DB only ever reflects transactions that provably exist on-chain.
 *
 * Verification steps (all must pass):
 *   1. Receipt exists and status === "success"
 *   2. chainId === BASE_CHAIN_ID (8453)
 *   3. receipt.to === USDC contract address
 *   4. A Transfer(from, to, value) log exists with the correct
 *      recipient address and exact token amount
 */

import { createPublicClient, http, parseUnits } from "viem";
import { base } from "@/lib/chains";
import { USDC } from "@/lib/usdc";

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_CHAIN_ID = 8453;

/**
 * keccak256("Transfer(address,address,uint256)")
 * The standard ERC-20 Transfer event topic, used to locate the relevant log.
 */
const TRANSFER_EVENT_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as const;

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 600; // doubles each retry: 600ms, 1200ms, 2400ms

// ─── Types ────────────────────────────────────────────────────────────────────

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: VerifyError; retryable: boolean };

/**
 * Granular error codes let the caller return the right HTTP status:
 *   - "rpc_error" → 503 (retryable)
 *   - "tx_not_found" → 400 (final)
 *   - "tx_failed" → 400 (final)
 *   - "wrong_chain" → 400 (final)
 *   - "tx_not_usdc" → 400 (final)
 *   - "tx_logs_mismatch" → 400 (final, possible fraud attempt)
 */
export type VerifyError =
  | "rpc_error"
  | "tx_not_found"
  | "tx_failed"
  | "wrong_chain"
  | "tx_not_usdc"
  | "tx_logs_mismatch";

// ─── Internal helpers ─────────────────────────────────────────────────────────

function makePublicClient() {
  const rpcUrl =
    process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org";
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl, {
      timeout: 12_000, // 12s; public nodes can be slow under load
    }),
  });
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = MAX_RETRIES,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await new Promise((r) =>
          setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)),
        );
      }
    }
  }
  throw lastError;
}

function isRetryableRpcError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("fetch failed")
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Verify that a USDC transfer transaction:
 *   - succeeded on Base mainnet
 *   - sent exactly `expectedAmount` USDC to `toAddress`
 *
 * @param txHash           - The 0x-prefixed 32-byte tx hash
 * @param toAddress        - Checksummed recipient address
 * @param expectedAmount   - Human-readable amount string, e.g. "12.50"
 * @param tokenAddress     - Defaults to Base canonical USDC
 * @param tokenDecimals    - Defaults to 6 (USDC)
 * @param chainId          - Defaults to 8453 (Base mainnet)
 */
export async function verifyUsdcTransfer(
  txHash: `0x${string}`,
  toAddress: string,
  expectedAmount: string,
  tokenAddress: string = USDC.address,
  tokenDecimals: number = USDC.decimals,
  chainId: number = BASE_CHAIN_ID,
): Promise<VerifyResult> {
  const client = makePublicClient();

  try {
    // Fetch receipt and transaction in parallel; retry together on transient errors
    const [receipt, tx] = await withRetry(() =>
      Promise.all([
        client.getTransactionReceipt({ hash: txHash }),
        client.getTransaction({ hash: txHash }),
      ]),
    );

    // 1. Transaction must have succeeded
    if (!receipt || receipt.status !== "success") {
      return { ok: false, error: "tx_failed", retryable: false };
    }

    // 2. Must be on Base mainnet
    if (Number(tx.chainId) !== chainId) {
      return { ok: false, error: "wrong_chain", retryable: false };
    }

    // 3. The tx must have been sent to the USDC contract
    if (receipt.to?.toLowerCase() !== tokenAddress.toLowerCase()) {
      return { ok: false, error: "tx_not_usdc", retryable: false };
    }

    // 4. Find a Transfer log that matches recipient + exact amount
    const expectedAmountWei = parseUnits(expectedAmount, tokenDecimals);

    const transferLog = receipt.logs.find((log) => {
      // Must be the ERC-20 Transfer event
      if (log.topics[0] !== TRANSFER_EVENT_TOPIC) return false;

      // Must be emitted by the USDC contract (not a wrapper or impostor)
      if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) return false;

      // topics[2] is the `to` address, padded to 32 bytes
      const logTo = `0x${(log.topics[2] ?? "").slice(-40)}`;
      if (logTo.toLowerCase() !== toAddress.toLowerCase()) return false;

      // log.data is the raw uint256 amount
      return BigInt(log.data) === expectedAmountWei;
    });

    if (!transferLog) {
      // The tx succeeded but didn't transfer the right amount to the right address.
      // This is either a front-run, a wrong-amount send, or a fraud attempt.
      return { ok: false, error: "tx_logs_mismatch", retryable: false };
    }

    return { ok: true };
  } catch (err) {
    // Distinguish "tx not found" (not yet indexed) from network errors
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.toLowerCase().includes("could not be found") ||
      message.toLowerCase().includes("not found") ||
      message.toLowerCase().includes("does not exist")
    ) {
      return { ok: false, error: "tx_not_found", retryable: true };
    }

    return {
      ok: false,
      error: "rpc_error",
      retryable: isRetryableRpcError(err),
    };
  }
}

/**
 * Map a VerifyError to the HTTP status code the route handler should return.
 *
 * Usage:
 *   const result = await verifyUsdcTransfer(...);
 *   if (!result.ok) {
 *     return NextResponse.json(
 *       { error: "tx_verification_failed", detail: result.error },
 *       { status: verifyErrorToStatus(result.error) },
 *     );
 *   }
 */
export function verifyErrorToStatus(error: VerifyError): number {
  switch (error) {
    case "rpc_error":
      return 503; // Service unavailable — client should retry
    case "tx_not_found":
      return 400; // May not be indexed yet; client can retry after a short wait
    case "tx_failed":
    case "wrong_chain":
    case "tx_not_usdc":
    case "tx_logs_mismatch":
      return 400; // Unambiguously invalid — client should not retry
    default:
      return 400;
  }
}
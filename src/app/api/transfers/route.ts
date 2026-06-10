import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicClient, http, parseUnits } from "viem";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePrivyUserIdFromRequest } from "@/lib/auth";
import { USDC } from "@/lib/usdc";
import { enforceRateLimit } from "@/lib/rateLimit";
import { requireFeatureEnabled } from "@/lib/featureFlags";
import { validateWalletAddress } from "@/lib/walletValidation";

const schema = z.object({
  to_username: z.string().optional(),
  to_wallet_address: z.string(),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  tx_hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

const TRANSFER_EVENT_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function getBasePublicClient() {
  const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org";
  return createPublicClient({
    transport: http(rpcUrl),
  });
}

async function verifyTransactionOnChain(
  txHash: `0x${string}`,
  expectedToAddress: string,
  expectedAmount: string,
) {
  const client = getBasePublicClient();

  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") return { ok: false, error: "tx_failed" };

    if (receipt.to?.toLowerCase() !== USDC.address.toLowerCase()) {
      return { ok: false, error: "tx_not_usdc" };
    }

    const tx = await client.getTransaction({ hash: txHash });
    if (Number(tx.chainId) !== 8453) return { ok: false, error: "wrong_chain" };

    const expectedAmountWei = parseUnits(expectedAmount, USDC.decimals);
    const transferLog = receipt.logs.find((log) => {
      if (log.topics[0] !== TRANSFER_EVENT_TOPIC) return false;
      if (log.address.toLowerCase() !== USDC.address.toLowerCase()) return false;
      const logTo = `0x${(log.topics[2] ?? "").slice(-40)}`;
      if (logTo.toLowerCase() !== expectedToAddress.toLowerCase()) return false;
      return BigInt(log.data) === expectedAmountWei;
    });

    if (!transferLog) {
      return { ok: false, error: "tx_logs_mismatch" };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "tx_not_found" };
  }
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, "default");
  if (limited) return limited;

  const disabled = await requireFeatureEnabled("transfers");
  if (disabled) return disabled;

  const allWritesDisabled = await requireFeatureEnabled("all_writes");
  if (allWritesDisabled) return allWritesDisabled;

  let userId: string;
  try {
    userId = await requirePrivyUserIdFromRequest(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 400 });
  }

  const toWallet = validateWalletAddress(parsed.data.to_wallet_address);
  if (!toWallet) {
    return NextResponse.json({ error: "invalid_wallet_address" }, { status: 400 });
  }

  const verification = await verifyTransactionOnChain(
    parsed.data.tx_hash as `0x${string}`,
    toWallet,
    parsed.data.amount,
  );
  if (!verification.ok) {
    return NextResponse.json(
      { error: "tx_verification_failed", detail: verification.error },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("transfers").insert({
    sender_privy_user_id: userId,
    to_username: parsed.data.to_username?.toLowerCase() ?? null,
    to_wallet_address: toWallet,
    chain_id: 8453,
    token_symbol: USDC.symbol,
    token_address: USDC.address,
    token_decimals: USDC.decimals,
    amount: parsed.data.amount,
    tx_hash: parsed.data.tx_hash,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "duplicate_tx_hash" }, { status: 409 });
    }
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

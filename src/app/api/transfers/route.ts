/**
 * src/app/api/transfers/route.ts
 *
 * POST /api/transfers
 *
 * Records a direct USDC transfer (send-by-username or send-by-address).
 * The on-chain verification is now imported from @/lib/onchain — the
 * same function used by sessions/[code]/pay — so both paths stay in sync.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePrivyUserIdFromRequest } from "@/lib/auth";
import { USDC } from "@/lib/usdc";
import { enforceRateLimit, getClientIp } from "@/lib/rateLimit";
import { requireFeatureEnabled } from "@/lib/featureFlags";
import { validateWalletAddress } from "@/lib/walletValidation";
import { verifyUsdcTransfer, verifyErrorToStatus } from "@/lib/onchain";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  to_username:       z.string().optional(),
  to_wallet_address: z.string(),
  amount:            z.string().regex(/^\d+(\.\d+)?$/),
  tx_hash:           z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── Rate limit ───────────────────────────────────────────────────────────
  const limited = await enforceRateLimit(req, "default");
  if (limited) return limited;

  // ── Feature flags ────────────────────────────────────────────────────────
  const transfersDisabled = await requireFeatureEnabled("transfers");
  if (transfersDisabled) return transfersDisabled;

  const allWritesDisabled = await requireFeatureEnabled("all_writes");
  if (allWritesDisabled) return allWritesDisabled;

  // ── Auth ──────────────────────────────────────────────────────────────────
  let userId: string;
  try {
    userId = await requirePrivyUserIdFromRequest(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── Validate body ─────────────────────────────────────────────────────────
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // ── Checksum-validate wallet address ─────────────────────────────────────
  const toWallet = validateWalletAddress(parsed.data.to_wallet_address);
  if (!toWallet) {
    return NextResponse.json(
      { error: "invalid_wallet_address" },
      { status: 400 },
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ON-CHAIN VERIFICATION  (shared with sessions/[code]/pay)
  // ─────────────────────────────────────────────────────────────────────────
  const verification = await verifyUsdcTransfer(
    parsed.data.tx_hash as `0x${string}`,
    toWallet,
    parsed.data.amount,
  );

  if (!verification.ok) {
    return NextResponse.json(
      {
        error: "tx_verification_failed",
        detail: verification.error,
        retryable: verification.retryable,
      },
      { status: verifyErrorToStatus(verification.error) },
    );
  }

  // ── Write to DB ───────────────────────────────────────────────────────────
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("transfers").insert({
    sender_privy_user_id: userId,
    to_username:          parsed.data.to_username?.toLowerCase() ?? null,
    to_wallet_address:    toWallet,
    chain_id:             8453,
    token_symbol:         USDC.symbol,
    token_address:        USDC.address,
    token_decimals:       USDC.decimals,
    amount:               parsed.data.amount,
    tx_hash:              parsed.data.tx_hash,
  });

  if (error) {
    // tx_hash UNIQUE constraint violation → already recorded (idempotent)
    if (error.code === "23505") {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: "db_error", detail: error.message },
      { status: 500 },
    );
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  supabase
    .from("audit_log")
    .insert({
      actor_privy_user_id: userId,
      event_type:          "transfer.created",
      resource_type:       "transfer",
      metadata: {
        tx_hash:    parsed.data.tx_hash,
        amount:     parsed.data.amount,
        to_wallet:  toWallet,
        to_username: parsed.data.to_username ?? null,
      },
      ip_address: getClientIp(req),
    })
    .then(undefined, () => {});

  return NextResponse.json({ ok: true });
}
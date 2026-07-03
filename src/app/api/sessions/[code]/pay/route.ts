/**
 * src/app/api/sessions/[code]/pay/route.ts
 *
 * POST /api/sessions/[code]/pay
 *
 * Called by the payer after they have sent the on-chain USDC transfer.
 * Records the payment ONLY after verifying the transaction exists on-chain,
 * targets the correct recipient wallet, and carries the correct amount.
 *
 * IMPORTANT: This endpoint does NOT require the caller to be authenticated
 * (the payer may not have a CryptoPay account). Rate limiting and on-chain
 * verification are the primary protection layers here.
 *
 * Flow:
 *   1. Validate request params and body
 *   2. Fetch session from DB (must be pending, not expired)
 *   3. Verify tx_hash on-chain via verifyUsdcTransfer()
 *   4. Update session to status="paid" with payer_tx_hash
 *   5. Write audit log entry
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enforceRateLimit, getClientIp } from "@/lib/rateLimit";
import { requireFeatureEnabled } from "@/lib/featureFlags";
import { verifyUsdcTransfer, verifyErrorToStatus } from "@/lib/onchain";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const paramsSchema = z.object({
  code: z
    .string()
    .min(6)
    .max(32)
    .regex(/^[A-Z0-9]+$/, "Invalid code format"),
});

const bodySchema = z.object({
  tx_hash: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash format"),
});

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  // ── Rate limit (no auth token available, so IP-based only) ──────────────
  const limited = await enforceRateLimit(req, "default");
  if (limited) return limited;

  // ── Feature flags ────────────────────────────────────────────────────────
  const sessionsDisabled = await requireFeatureEnabled("payment_sessions");
  if (sessionsDisabled) return sessionsDisabled;

  const allWritesDisabled = await requireFeatureEnabled("all_writes");
  if (allWritesDisabled) return allWritesDisabled;

  // ── Validate route param ─────────────────────────────────────────────────
  const params = await ctx.params;
  const paramsParsed = paramsSchema.safeParse({ code: params.code });
  if (!paramsParsed.success) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  const code = paramsParsed.data.code;

  // ── Validate request body ─────────────────────────────────────────────────
  const rawBody = await req.json().catch(() => ({}));
  const bodyParsed = bodySchema.safeParse(rawBody);
  if (!bodyParsed.success) {
    return NextResponse.json(
      { error: "invalid_body", detail: bodyParsed.error.flatten() },
      { status: 400 },
    );
  }
  const { tx_hash } = bodyParsed.data;

  const supabase = getSupabaseAdmin();

  // ── Fetch the full session (we need amount + receiver to verify on-chain) ──
  const { data: session, error: fetchError } = await supabase
    .from("payment_sessions")
    .select(
      "id, status, expires_at, amount, token_address, token_decimals, receiver_wallet_address, creator_privy_user_id",
    )
    .eq("short_code", code)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: "db_error", detail: fetchError.message },
      { status: 500 },
    );
  }
  if (!session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // ── Idempotency: already paid ─────────────────────────────────────────────
  if (session.status === "paid") {
    return NextResponse.json({ ok: true });
  }

  // ── Reject if expired ─────────────────────────────────────────────────────
  if (new Date(session.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "expired" }, { status: 409 });
  }

  // ── Reject cancelled or any other non-pending state ──────────────────────
  if (session.status !== "pending") {
    return NextResponse.json(
      { error: "not_payable", detail: session.status },
      { status: 409 },
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ON-CHAIN VERIFICATION
  //
  // This is the critical step that was missing in v0.1.
  // We must confirm that tx_hash:
  //   (a) exists on Base mainnet and succeeded
  //   (b) transferred the correct amount of USDC
  //   (c) sent it to the correct recipient wallet
  //
  // Without this check, any caller could POST a made-up hash and
  // mark a payment session as paid without actually paying.
  // ─────────────────────────────────────────────────────────────────────────
  const verification = await verifyUsdcTransfer(
    tx_hash as `0x${string}`,
    session.receiver_wallet_address,
    session.amount,
    session.token_address,
    session.token_decimals,
  );

  if (!verification.ok) {
    // Write an audit entry for every rejection so we can detect fraud patterns
    await supabase.from("audit_log").insert({
      event_type: "session.pay_rejected",
      resource_type: "payment_session",
      resource_id: session.id,
      metadata: {
        short_code: code,
        tx_hash,
        reason: verification.error,
      },
      ip_address: getClientIp(req),
    });

    return NextResponse.json(
      {
        error: "tx_verification_failed",
        detail: verification.error,
        // Tell the client whether a retry makes sense
        retryable: verification.retryable,
      },
      { status: verifyErrorToStatus(verification.error) },
    );
  }

  // ── Mark session paid ─────────────────────────────────────────────────────
  const { data: updated, error: updateError } = await supabase
    .from("payment_sessions")
    .update({
      status: "paid",
      payer_tx_hash: tx_hash,
    })
    .eq("id", session.id)
    // Double-check status is still pending (guards against a race
    // where two payers submit at the same time)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { error: "db_error", detail: updateError.message },
      { status: 500 },
    );
  }
  
  if (!updated) {
    // Another payer's tx already settled this session between fetch and update.
    // This payer's tx is real and verified, but don't log a paid event for a
    // row we didn't actually update.
    return NextResponse.json({ ok: true, note: "already_settled_by_other_tx" });
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  // Fire-and-forget; don't let an audit write failure block the response
  supabase
    .from("audit_log")
    .insert({
      event_type: "session.paid",
      resource_type: "payment_session",
      resource_id: session.id,
      metadata: {
        short_code: code,
        tx_hash,
        amount: session.amount,
        receiver: session.receiver_wallet_address,
      },
      ip_address: getClientIp(req),
    })
    .then(undefined, () => {});

  return NextResponse.json({ ok: true });
}
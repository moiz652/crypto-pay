import { NextResponse } from "next/server";
import { z } from "zod";
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

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, "default");
  if (limited) return limited;

  const disabled = await requireFeatureEnabled("transfers");
  if (disabled) return disabled;

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

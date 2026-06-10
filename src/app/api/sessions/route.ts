import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePrivyUserIdFromRequest } from "@/lib/auth";
import { generateShortCode } from "@/lib/shortCode";
import { USDC } from "@/lib/usdc";
import { enforceRateLimit } from "@/lib/rateLimit";
import { requireFeatureEnabled } from "@/lib/featureFlags";

const createSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .refine((v) => Number(v) > 0, "amount must be > 0"),
});

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, "sessions_create");
  if (limited) return limited;

  const disabled = await requireFeatureEnabled("payment_sessions");
  if (disabled) return disabled;

  const sessionsCreateDisabled = await requireFeatureEnabled("sessions_create");
  if (sessionsCreateDisabled) return sessionsCreateDisabled;

  const allWritesDisabled = await requireFeatureEnabled("all_writes");
  if (allWritesDisabled) return allWritesDisabled;

  let userId: string;
  try {
    userId = await requirePrivyUserIdFromRequest(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("wallet_address,username,display_name")
    .eq("privy_user_id", userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: "db_error", detail: profileError.message }, { status: 500 });
  }
  if (!profile?.wallet_address) {
    return NextResponse.json({ error: "missing_wallet" }, { status: 400 });
  }

  const short_code = generateShortCode(10);
  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("payment_sessions")
    .insert({
      short_code,
      creator_privy_user_id: userId,
      chain_id: 8453,
      token_symbol: USDC.symbol,
      token_address: USDC.address,
      token_decimals: USDC.decimals,
      amount: parsed.data.amount,
      receiver_wallet_address: profile.wallet_address,
      expires_at,
      status: "pending",
    })
    .select("short_code,amount,token_symbol,chain_id,expires_at,status")
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({
    session: data,
  });
}

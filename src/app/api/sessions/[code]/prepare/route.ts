import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePrivyUserIdFromRequest } from "@/lib/auth";
import { requireFeatureEnabled } from "@/lib/featureFlags";
import { enforceRateLimit } from "@/lib/rateLimit";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const paramsSchema = z.object({
  code: z.string().min(6).max(32).regex(/^[A-Z0-9]+$/),
});

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const limited = await enforceRateLimit(req, "sessions_get");
  if (limited) return limited;

  const disabled = await requireFeatureEnabled("payment_sessions");
  if (disabled) return disabled;

  let userId: string;
  try {
    userId = await requirePrivyUserIdFromRequest(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const parsed = paramsSchema.safeParse({ code: params.code });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const code = parsed.data.code;

  const { data, error } = await supabase
    .from("payment_sessions")
    .select(
      "short_code,amount,token_symbol,token_address,token_decimals,chain_id,status,expires_at,receiver_wallet_address,creator_privy_user_id",
    )
    .eq("short_code", code)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const expired = new Date(data.expires_at).getTime() < Date.now();
  const status = expired && data.status === "pending" ? "expired" : data.status;
  if (status !== "pending") {
    return NextResponse.json({ error: "not_payable", status }, { status: 409 });
  }

  if (data.creator_privy_user_id === userId) {
    return NextResponse.json({ error: "cannot_pay_own_request" }, { status: 400 });
  }

  return NextResponse.json({
    prepare: {
      short_code: data.short_code,
      amount: data.amount,
      token_symbol: data.token_symbol,
      token_address: data.token_address,
      token_decimals: data.token_decimals,
      chain_id: data.chain_id,
      receiver_wallet_address: data.receiver_wallet_address,
      expires_at: data.expires_at,
    },
  });
}

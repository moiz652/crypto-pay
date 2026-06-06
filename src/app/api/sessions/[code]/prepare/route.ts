import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePrivyUserIdFromRequest } from "@/lib/auth";
import { requireFeatureEnabled } from "@/lib/featureFlags";
import { enforceRateLimit } from "@/lib/rateLimit";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const paramsSchema = z.object({
  code: z.string().min(6).max(32).regex(/^[A-Z0-9]+$/),
});

function prepareError(
  status: number,
  error: string,
  message: string,
  context?: Record<string, unknown>,
) {
  console.error("[sessions/prepare]", { error, message, ...context });
  return NextResponse.json({ error, message }, { status });
}

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const limited = await enforceRateLimit(req, "sessions_get");
  if (limited) return limited;

  const disabled = await requireFeatureEnabled("payment_sessions");
  if (disabled) return disabled;

  let userId: string;
  try {
    userId = await requirePrivyUserIdFromRequest(req);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return prepareError(
      401,
      "unauthorized",
      detail === "missing_auth"
        ? "Missing authentication token."
        : "Invalid or expired authentication token.",
      { authError: detail },
    );
  }

  const params = await ctx.params;
  const parsed = paramsSchema.safeParse({ code: params.code });
  if (!parsed.success) {
    return prepareError(400, "invalid_code", "Invalid payment link code format.", {
      code: params.code,
      issues: parsed.error.issues,
    });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return prepareError(500, "config_error", `Server configuration error: ${detail}`);
  }

  const code = parsed.data.code;

  const { data, error } = await supabase
    .from("payment_sessions")
    .select(
      "short_code,amount,token_symbol,token_address,token_decimals,chain_id,status,expires_at,receiver_wallet_address,creator_privy_user_id",
    )
    .eq("short_code", code)
    .maybeSingle();

  if (error) {
    return prepareError(500, "db_error", `Database lookup failed: ${error.message}`, {
      code,
      dbCode: error.code,
    });
  }
  if (!data) {
    return prepareError(404, "not_found", "Payment session not found.", { code });
  }

  const expired = new Date(data.expires_at).getTime() < Date.now();
  const status = expired && data.status === "pending" ? "expired" : data.status;
  if (status !== "pending") {
    return prepareError(
      409,
      "not_payable",
      status === "paid"
        ? "This payment link has already been paid."
        : status === "expired"
          ? "This payment link has expired."
          : "This payment link is not payable.",
      { code, status },
    );
  }

  if (data.creator_privy_user_id === userId) {
    return prepareError(
      400,
      "cannot_pay_own_request",
      "You cannot pay your own payment request.",
      { code, userId },
    );
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

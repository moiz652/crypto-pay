import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enforceRateLimit } from "@/lib/rateLimit";

const paramsSchema = z.object({
  code: z.string().min(6).max(32).regex(/^[A-Z0-9]+$/),
});

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const limited = await enforceRateLimit(_req, "sessions_get");
  if (limited) return limited;

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
      "amount,token_symbol,status,expires_at,creator_privy_user_id",
    )
    .eq("short_code", code)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: creator } = await supabase
    .from("profiles")
    .select("display_name,username")
    .eq("privy_user_id", data.creator_privy_user_id)
    .maybeSingle();

  const expired = new Date(data.expires_at).getTime() < Date.now();
  const status = expired && data.status === "pending" ? "expired" : data.status;

  return NextResponse.json({
    session: {
      creator_display_name: creator?.display_name ?? creator?.username ?? "Someone",
      amount: data.amount,
      token: data.token_symbol,
      status,
      expiry: data.expires_at,
    },
  });
}

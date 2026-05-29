import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const paramsSchema = z.object({
  code: z.string().min(6).max(32).regex(/^[A-Z0-9]+$/),
});

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
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
      "short_code,amount,token_symbol,token_address,token_decimals,chain_id,status,expires_at,receiver_wallet_address,payer_tx_hash",
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

  return NextResponse.json({
    session: {
      ...data,
      status,
    },
  });
}


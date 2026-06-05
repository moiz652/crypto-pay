import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enforceRateLimit } from "@/lib/rateLimit";
import { requireFeatureEnabled } from "@/lib/featureFlags";

const paramsSchema = z.object({
  code: z.string().min(6).max(32).regex(/^[A-Z0-9]+$/),
});

const bodySchema = z.object({
  tx_hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const limited = await enforceRateLimit(req, "default");
  if (limited) return limited;

  const disabled = await requireFeatureEnabled("payment_sessions");
  if (disabled) return disabled;

  const params = await ctx.params;
  const paramsParsed = paramsSchema.safeParse({ code: params.code });
  if (!paramsParsed.success) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const bodyParsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!bodyParsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const code = paramsParsed.data.code;

  const { data: session, error: fetchError } = await supabase
    .from("payment_sessions")
    .select("id,status,expires_at")
    .eq("short_code", code)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "db_error", detail: fetchError.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const expired = new Date(session.expires_at).getTime() < Date.now();
  if (expired) {
    return NextResponse.json({ error: "expired" }, { status: 409 });
  }
  if (session.status === "paid") {
    return NextResponse.json({ ok: true });
  }

  const { error: updateError } = await supabase
    .from("payment_sessions")
    .update({ status: "paid", payer_tx_hash: bodyParsed.data.tx_hash })
    .eq("id", session.id);

  if (updateError) {
    return NextResponse.json({ error: "db_error", detail: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

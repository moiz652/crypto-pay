import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePrivyUserIdFromRequest } from "@/lib/auth";
import { USDC } from "@/lib/usdc";

const schema = z.object({
  to_username: z.string().optional(),
  to_wallet_address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  tx_hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export async function POST(req: Request) {
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

  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("transfers").insert({
    sender_privy_user_id: userId,
    to_username: parsed.data.to_username?.toLowerCase() ?? null,
    to_wallet_address: parsed.data.to_wallet_address,
    chain_id: 8453,
    token_symbol: USDC.symbol,
    token_address: USDC.address,
    token_decimals: USDC.decimals,
    amount: parsed.data.amount,
    tx_hash: parsed.data.tx_hash,
  });

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}


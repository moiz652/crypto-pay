import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrivyClient } from "@/lib/privyServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const bodySchema = z.object({
  wallet_address: z.string().optional(),
  display_name: z.string().optional(),
});

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer (.+)$/i);
  return m?.[1];
}

export async function POST(req: Request) {
  const privy = getPrivyClient();
  const supabaseAdmin = getSupabaseAdmin();

  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "missing_auth" }, { status: 401 });
  }

  let claims: { userId: string };
  try {
    const verified = await privy.utils().auth().verifyAccessToken(token);
    claims = { userId: verified.user_id };
  } catch {
    return NextResponse.json({ error: "invalid_auth" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { wallet_address, display_name } = parsed.data;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        privy_user_id: claims.userId,
        wallet_address: wallet_address ?? null,
        display_name: display_name ?? null,
      },
      { onConflict: "privy_user_id" },
    )
    .select("id, privy_user_id, username, wallet_address, display_name")
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}


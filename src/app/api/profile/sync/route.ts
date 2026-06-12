import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrivyClient } from "@/lib/privyServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enforceRateLimit } from "@/lib/rateLimit";
import { requireFeatureEnabled } from "@/lib/featureFlags";
import { validateWalletAddress } from "@/lib/walletValidation";

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
  const limited = await enforceRateLimit(req, "profile_sync");
  if (limited) return limited;

  const disabled = await requireFeatureEnabled("profile_sync");
  if (disabled) return disabled;

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

  const upsertPayload: {
    privy_user_id: string;
    wallet_address?: string | null;
    display_name?: string | null;
  } = {
    privy_user_id: claims.userId,
  };

  if (wallet_address !== undefined) {
    if (wallet_address === "") {
      upsertPayload.wallet_address = null;
    } else {
      const validated = validateWalletAddress(wallet_address);
      if (!validated) {
        return NextResponse.json({ error: "invalid_wallet_address" }, { status: 400 });
      }
      upsertPayload.wallet_address = validated;
    }
  }

  if (display_name !== undefined) {
    upsertPayload.display_name = display_name ?? null;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert(upsertPayload, { onConflict: "privy_user_id" })
    .select("id, username, wallet_address, display_name")
    .single();

  if (error) {
    console.error("[profile/sync] db_error:", error);
    const body: Record<string, string> = {
      error: "db_error",
      detail: error.message,
    };
    if (error.code === "42501" && process.env.NODE_ENV === "development") {
      body.hint =
        "Run supabase/grant-privileges.sql in the Supabase SQL editor (service_role lacks table grants).";
    }
    return NextResponse.json(body, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

import { NextResponse } from "next/server";
import { getPrivyClient } from "@/lib/privyServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enforceRateLimit } from "@/lib/rateLimit";
import { requireFeatureEnabled } from "@/lib/featureFlags";

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer (.+)$/i);
  return m?.[1];
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, "default");
  if (limited) return limited;

  const disabled = await requireFeatureEnabled("profile_sync");
  if (disabled) return disabled;

  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "missing_auth" }, { status: 401 });

  const privy = getPrivyClient();
  const supabase = getSupabaseAdmin();

  let userId: string;
  try {
    const verified = await privy.utils().auth().verifyAccessToken(token);
    userId = verified.user_id;
  } catch {
    return NextResponse.json({ error: "invalid_auth" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ acknowledged_irreversibility_at: new Date().toISOString() })
    .eq("privy_user_id", userId)
    .select("acknowledged_irreversibility_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ acknowledged_irreversibility_at: data.acknowledged_irreversibility_at });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrivyClient } from "@/lib/privyServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enforceRateLimit } from "@/lib/rateLimit";
import { requireFeatureEnabled } from "@/lib/featureFlags";

const bodySchema = z.object({
  username: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9_]+$/i, "Use only letters, numbers, underscores"),
});

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

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 400 });
  }

  const username = parsed.data.username.toLowerCase();

  const { data, error } = await supabase
    .from("profiles")
    .update({ username })
    .eq("privy_user_id", userId)
    .select("id,username")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

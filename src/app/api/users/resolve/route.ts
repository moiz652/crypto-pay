import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enforceRateLimit } from "@/lib/rateLimit";
import { requireFeatureEnabled } from "@/lib/featureFlags";

const schema = z.object({
  username: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9_]+$/i),
});

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req, "users_resolve");
  if (limited) return limited;

  const disabled = await requireFeatureEnabled("users_resolve");
  if (disabled) return disabled;

  const url = new URL(req.url);
  const parsed = schema.safeParse({ username: url.searchParams.get("username") });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_username" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const username = parsed.data.username.toLowerCase();

  const { data, error } = await supabase
    .from("profiles")
    .select("username,wallet_address,display_name")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }
  if (!data?.wallet_address) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    profile: {
      username: data.username,
      display_name: data.display_name,
      wallet_address: data.wallet_address,
    },
  });
}

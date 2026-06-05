import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const cache = new Map<string, { enabled: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

export async function isFeatureEnabled(featureName: string): Promise<boolean> {
  const cached = cache.get(featureName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.enabled;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("feature_name", featureName)
    .maybeSingle();

  if (error || !data) {
    return true;
  }

  cache.set(featureName, { enabled: data.enabled, expiresAt: Date.now() + CACHE_TTL_MS });
  return data.enabled;
}

export async function requireFeatureEnabled(
  featureName: string,
): Promise<NextResponse | null> {
  const enabled = await isFeatureEnabled(featureName);
  if (!enabled) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 503 });
  }
  return null;
}

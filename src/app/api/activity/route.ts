import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePrivyUserIdFromRequest } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rateLimit";
import { requireFeatureEnabled } from "@/lib/featureFlags";

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req, "activity");
  if (limited) return limited;

  const disabled = await requireFeatureEnabled("activity");
  if (disabled) return disabled;

  let userId: string;
  try {
    userId = await requirePrivyUserIdFromRequest(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("wallet_address,username")
    .eq("privy_user_id", userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: "db_error", detail: profileError.message }, { status: 500 });
  }

  const wallet = profile?.wallet_address ?? null;

  const [{ data: sentTransfers, error: sentErr }, { data: myRequests, error: reqErr }, { data: receivedRequests, error: recvErr }] =
    await Promise.all([
      supabase
        .from("transfers")
        .select("created_at,to_username,to_wallet_address,amount,token_symbol,tx_hash")
        .eq("sender_privy_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("payment_sessions")
        .select("created_at,short_code,amount,token_symbol,status,expires_at,payer_tx_hash")
        .eq("creator_privy_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      wallet
        ? supabase
            .from("payment_sessions")
            .select("created_at,short_code,amount,token_symbol,status,expires_at,payer_tx_hash")
            .eq("receiver_wallet_address", wallet)
            .neq("creator_privy_user_id", userId)
            .order("created_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const firstError = sentErr ?? reqErr ?? recvErr;
  if (firstError) {
    return NextResponse.json({ error: "db_error", detail: firstError.message }, { status: 500 });
  }

  const now = Date.now();
  const normalizeStatus = (status: string, expires_at: string) => {
    if (status === "pending" && new Date(expires_at).getTime() < now) return "expired";
    return status;
  };

  return NextResponse.json({
    sentTransfers: sentTransfers ?? [],
    myRequests: (myRequests ?? []).map((r) => ({
      ...r,
      status: normalizeStatus(r.status, r.expires_at),
    })),
    receivedRequests: (receivedRequests ?? []).map((r) => ({
      ...r,
      status: normalizeStatus(r.status, r.expires_at),
    })),
  });
}

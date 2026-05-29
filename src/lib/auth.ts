import { getPrivyClient } from "@/lib/privyServer";

export async function requirePrivyUserIdFromRequest(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer (.+)$/i);
  const token = m?.[1];
  if (!token) throw new Error("missing_auth");

  const privy = getPrivyClient();
  const verified = await privy.utils().auth().verifyAccessToken(token);
  return verified.user_id;
}


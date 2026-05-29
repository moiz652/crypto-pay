import { PrivyClient } from "@privy-io/node";
import { requireServerEnv } from "@/lib/env.server";

export function getPrivyClient() {
  const env = requireServerEnv();
  return new PrivyClient({
    appId: env.PRIVY_APP_ID,
    appSecret: env.PRIVY_APP_SECRET,
  });
}


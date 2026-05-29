import { createPublicClient, http } from "viem";
import { base } from "@/lib/chains";

export const publicClient = createPublicClient({
  chain: base,
  transport: http(base.rpcUrls.default.http[0]),
});


import { getAddress, isAddress } from "viem";

export function validateWalletAddress(raw: string): `0x${string}` | null {
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null;
  if (!isAddress(raw)) return null;
  try {
    return getAddress(raw);
  } catch {
    return null;
  }
}

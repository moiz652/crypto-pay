import { encodeFunctionData, parseUnits, type Address } from "viem";
import { base } from "@/lib/chains";
import { USDC, erc20Abi } from "@/lib/usdc";
import { publicClient } from "@/lib/viem";

const BASE_CHAIN_ID = base.id;

type WalletWithChain = {
  address: string;
  chainId?: string;
  switchChain: (targetChainId: number) => Promise<void>;
};

export async function ensureBaseChain(wallet: WalletWithChain): Promise<void> {
  const current = wallet.chainId ? Number(wallet.chainId) : undefined;
  if (current === BASE_CHAIN_ID) return;

  try {
    await wallet.switchChain(BASE_CHAIN_ID);
  } catch {
    throw new Error("Please switch your wallet to Base network to continue.");
  }

  const after = wallet.chainId ? Number(wallet.chainId) : undefined;
  if (after !== undefined && after !== BASE_CHAIN_ID) {
    throw new Error("Please switch your wallet to Base network to continue.");
  }
}

export async function simulateUsdcTransfer(params: {
  from: Address;
  to: Address;
  amount: string;
  decimals?: number;
}): Promise<{ to: Address; data: `0x${string}` }> {
  const decimals = params.decimals ?? USDC.decimals;
  const amountWei = parseUnits(params.amount, decimals);

  await publicClient.simulateContract({
    address: USDC.address,
    abi: erc20Abi,
    functionName: "transfer",
    args: [params.to, amountWei],
    account: params.from,
  });

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [params.to, amountWei],
  });

  return { to: USDC.address, data };
}

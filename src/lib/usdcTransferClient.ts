import { encodeFunctionData, parseUnits, type Address } from "viem";
import { base } from "@/lib/chains";
import { USDC, erc20Abi } from "@/lib/usdc";
import { publicClient } from "@/lib/viem";

const BASE_CHAIN_ID = base.id;

const FRIENDLY_INSUFFICIENT_BALANCE =
  "Insufficient USDC balance. Add funds to your wallet and try again.";
const FRIENDLY_EXECUTION_REVERTED = "Transaction failed. Please try again.";
const FRIENDLY_GENERIC = "Something went wrong. Please try again later.";

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "";
}

function looksLikeRawBlockchainError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /0x[a-f0-9]{8,}/i.test(message) ||
    lower.includes("contractfunction") ||
    lower.includes("basecontract") ||
    lower.includes("viem") ||
    lower.includes("stack trace") ||
    /\n\s+at /.test(message) ||
    lower.includes("args:") ||
    lower.includes("revert data")
  );
}

function mapContractSimulationError(err: unknown): string {
  const message = extractErrorMessage(err).toLowerCase();
  if (message.includes("transfer amount exceeds balance")) {
    return FRIENDLY_INSUFFICIENT_BALANCE;
  }
  if (message.includes("execution reverted")) {
    return FRIENDLY_EXECUTION_REVERTED;
  }
  return FRIENDLY_GENERIC;
}

export function sanitizeTransactionError(err: unknown): string {
  const message = extractErrorMessage(err).trim();
  if (!message) return FRIENDLY_GENERIC;

  if (!looksLikeRawBlockchainError(message)) {
    return message;
  }

  const lower = message.toLowerCase();
  if (
    lower.includes("transfer amount exceeds balance") ||
    lower.includes("exceeds balance") ||
    (lower.includes("insufficient") &&
      (lower.includes("fund") || lower.includes("balance")))
  ) {
    return FRIENDLY_INSUFFICIENT_BALANCE;
  }
  if (lower.includes("execution reverted")) {
    return FRIENDLY_EXECUTION_REVERTED;
  }
  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request")
  ) {
    return "Transaction cancelled.";
  }
  return FRIENDLY_GENERIC;
}

type WalletWithChain = {
  address: string;
  chainId?: string;
  switchChain: (targetChainId: number) => Promise<void>;
  getEthereumProvider?: () => Promise<{
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  }>;
};

async function addBaseChain(wallet: WalletWithChain): Promise<void> {
  if (!wallet.getEthereumProvider) return;

  const provider = await wallet.getEthereumProvider();
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: `0x${BASE_CHAIN_ID.toString(16)}`,
        chainName: base.name,
        nativeCurrency: base.nativeCurrency,
        rpcUrls: [...base.rpcUrls.default.http],
        blockExplorerUrls: ["https://basescan.org"],
      },
    ],
  });
}

export async function ensureBaseChain(wallet: WalletWithChain): Promise<void> {
  const current = wallet.chainId ? Number(wallet.chainId) : undefined;
  if (current === BASE_CHAIN_ID) return;

  const switchToBase = async () => {
    await wallet.switchChain(BASE_CHAIN_ID);
  };

  try {
    await switchToBase();
  } catch {
    try {
      await addBaseChain(wallet);
      await switchToBase();
    } catch {
      throw new Error("Please switch your wallet to Base network to continue.");
    }
  }

  const after = wallet.chainId ? Number(wallet.chainId) : undefined;
  if (after !== undefined && after !== BASE_CHAIN_ID) {
    try {
      await switchToBase();
    } catch {
      throw new Error("Please switch your wallet to Base network to continue.");
    }
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

  try {
    await publicClient.simulateContract({
      address: USDC.address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [params.to, amountWei],
      account: params.from,
    });
  } catch (err) {
    throw new Error(mapContractSimulationError(err));
  }

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [params.to, amountWei],
  });

  return { to: USDC.address, data };
}

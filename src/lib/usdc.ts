export const USDC = {
  // Base USDC (canonical) — update if you prefer Circle-native vs bridged.
  // For MVP we keep this configurable via env.
  address: (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as `0x${string}`,
  decimals: 6,
  symbol: "USDC",
  name: "USD Coin",
} as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "ok", type: "bool" }],
  },
] as const;


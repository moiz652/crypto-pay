"use client";

import { useMemo, useState } from "react";
import { encodeFunctionData, parseUnits } from "viem";
import useSWR from "swr";
import { usePrivy, useWallets, useSendTransaction } from "@privy-io/react-auth";
import { USDC, erc20Abi } from "@/lib/usdc";

function normalizeUsername(raw: string) {
  const trimmed = raw.trim().replace(/^@/, "");
  return trimmed.toLowerCase();
}

export function SendUsdc({ fromAddress }: { fromAddress?: `0x${string}` }) {
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();

  const wallet = useMemo(() => {
    return wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  }, [wallets]);

  const [toUsername, setToUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "sending" }
    | { type: "sent"; txHash: string }
    | { type: "error"; message: string }
  >({ type: "idle" });

  const username = useMemo(() => normalizeUsername(toUsername), [toUsername]);
  const canLookup = username.length >= 2;

  const { data: resolved } = useSWR(
    authenticated && canLookup ? ["resolve", username] : null,
    async () => {
      const res = await fetch(`/api/users/resolve?username=${encodeURIComponent(username)}`);
      if (!res.ok) return null;
      return res.json() as Promise<{
        profile: { wallet_address: `0x${string}`; username: string; display_name?: string | null };
      }>;
    },
  );

  const toAddress = resolved?.profile?.wallet_address;
  const sameAsSender =
    fromAddress && toAddress && fromAddress.toLowerCase() === toAddress.toLowerCase();

  const amountWei = useMemo(() => {
    try {
      if (!amount) return null;
      if (!/^\d+(\.\d+)?$/.test(amount)) return null;
      return parseUnits(amount, USDC.decimals);
    } catch {
      return null;
    }
  }, [amount]);

  const canSend =
    Boolean(wallet?.address) &&
    Boolean(toAddress) &&
    Boolean(amountWei) &&
    !sameAsSender &&
    status.type !== "sending";

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold">Send USDC</p>
      <p className="mt-1 text-xs text-white/60">
        Send on Base using <span className="font-mono">@username</span>.
      </p>

      <div className="mt-3 grid gap-2">
        <input
          value={toUsername}
          onChange={(e) => setToUsername(e.target.value)}
          placeholder="@moiz"
          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-white/30"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (e.g. 5 or 12.5)"
          inputMode="decimal"
          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-white/30"
        />
      </div>

      <div className="mt-2 text-xs text-white/60">
        {toAddress ? (
          <p>
            Paying <span className="font-mono">@{resolved?.profile?.username}</span> →{" "}
            <span className="font-mono">{toAddress}</span>
          </p>
        ) : canLookup ? (
          <p>Looking up recipient…</p>
        ) : null}
        {sameAsSender ? (
          <p className="text-red-300/90">Recipient can’t be your own wallet.</p>
        ) : null}
      </div>

      <button
        type="button"
        disabled={!canSend}
        onClick={async () => {
          if (!wallet?.address || !toAddress || !amountWei) return;
          setStatus({ type: "sending" });
          try {
            const data = encodeFunctionData({
              abi: erc20Abi,
              functionName: "transfer",
              args: [toAddress, amountWei],
            });
            const result = await sendTransaction(
              {
                to: USDC.address,
                data,
              },
              { address: wallet.address },
            );
            try {
              const token = await getAccessToken();
              await fetch("/api/transfers", {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  to_username: resolved?.profile?.username,
                  to_wallet_address: toAddress,
                  amount,
                  tx_hash: result.hash,
                }),
              });
            } catch {
              // Non-blocking for MVP: chain tx is source of truth.
            }
            setStatus({ type: "sent", txHash: result.hash });
          } catch {
            setStatus({ type: "error", message: "Transaction failed or was rejected." });
          }
        }}
        className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#070b14] disabled:opacity-50"
      >
        {status.type === "sending" ? "Sending…" : "Send"}
      </button>

      {status.type === "sent" ? (
        <p className="mt-2 break-all text-xs text-emerald-300/90">
          Sent. Tx: {status.txHash}
        </p>
      ) : status.type === "error" ? (
        <p className="mt-2 text-xs text-red-300/90">{status.message}</p>
      ) : null}
    </div>
  );
}


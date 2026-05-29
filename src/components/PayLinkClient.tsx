"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { encodeFunctionData, parseUnits } from "viem";
import { usePrivy, useWallets, useSendTransaction } from "@privy-io/react-auth";
import { erc20Abi } from "@/lib/usdc";

type Session = {
  short_code: string;
  amount: string;
  token_symbol: string;
  token_address: `0x${string}`;
  token_decimals: number;
  chain_id: number;
  status: string;
  expires_at: string;
  receiver_wallet_address: `0x${string}`;
  payer_tx_hash?: string | null;
};

export function PayLinkClient({ code }: { code: string }) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();

  const wallet = useMemo(() => {
    return wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  }, [wallets]);

  const { data, error, mutate } = useSWR(
    ["session", code],
    async () => {
      const res = await fetch(`/api/sessions/${encodeURIComponent(code)}`);
      if (!res.ok) throw new Error("not_found");
      const json = (await res.json()) as { session: Session };
      return json.session;
    },
    { refreshInterval: 10_000 },
  );

  const session = data;

  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "sending" }
    | { type: "sent"; txHash: string }
    | { type: "error"; message: string }
  >({ type: "idle" });

  if (error) {
    return (
      <main className="min-h-dvh bg-[#070b14] text-white">
        <div className="mx-auto max-w-md px-6 py-10">
          <p className="text-sm font-semibold">Link not found</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-dvh bg-[#070b14] text-white">
        <div className="mx-auto max-w-md px-6 py-10">
          <p className="text-sm text-white/70">Loading…</p>
        </div>
      </main>
    );
  }

  const payable = session.status === "pending";

  return (
    <main className="min-h-dvh bg-[#070b14] text-white">
      <div className="mx-auto max-w-md px-6 py-10">
        <p className="text-xs text-white/60">Crypto Pay</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Payment request</h1>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-white/60">Amount</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            {session.amount}{" "}
            <span className="text-base font-medium text-white/70">
              {session.token_symbol}
            </span>
          </p>
          <p className="mt-2 text-xs text-white/50">Network: Base</p>

          {!payable ? (
            <p className="mt-4 text-sm text-white/70">
              {session.status === "paid"
                ? "Already paid."
                : session.status === "expired"
                  ? "This link has expired."
                  : "This link is not payable."}
            </p>
          ) : !ready ? (
            <p className="mt-4 text-sm text-white/70">Loading…</p>
          ) : !authenticated ? (
            <button
              type="button"
              onClick={login}
              className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#070b14]"
            >
              Sign in to pay
            </button>
          ) : (
            <button
              type="button"
              disabled={!wallet?.address || status.type === "sending"}
              onClick={async () => {
                if (!wallet?.address) return;
                setStatus({ type: "sending" });
                try {
                  const amountWei = parseUnits(
                    session.amount,
                    session.token_decimals,
                  );
                  const data = encodeFunctionData({
                    abi: erc20Abi,
                    functionName: "transfer",
                    args: [session.receiver_wallet_address, amountWei],
                  });

                  const result = await sendTransaction(
                    { to: session.token_address, data },
                    { address: wallet.address },
                  );

                  await fetch(`/api/sessions/${encodeURIComponent(code)}/pay`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ tx_hash: result.hash }),
                  });

                  setStatus({ type: "sent", txHash: result.hash });
                  await mutate();
                } catch {
                  setStatus({
                    type: "error",
                    message: "Transaction failed or was rejected.",
                  });
                }
              }}
              className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#070b14] disabled:opacity-50"
            >
              {status.type === "sending"
                ? "Sending…"
                : `Pay ${session.amount} ${session.token_symbol}`}
            </button>
          )}

          {status.type === "sent" ? (
            <p className="mt-3 break-all text-xs text-emerald-300/90">
              Tx: {status.txHash}
            </p>
          ) : status.type === "error" ? (
            <p className="mt-3 text-xs text-red-300/90">{status.message}</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}


"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { usePrivy, useWallets, useSendTransaction } from "@privy-io/react-auth";
import {
  ensureBaseChain,
  sanitizeTransactionError,
  simulateUsdcTransfer,
} from "@/lib/usdcTransferClient";
import { TransactionConfirmModal } from "@/components/TransactionConfirmModal";

type PublicSession = {
  creator_display_name: string;
  amount: string;
  token: string;
  status: string;
  expiry: string;
};

type PreparePayload = {
  short_code: string;
  amount: string;
  token_symbol: string;
  token_address: `0x${string}`;
  token_decimals: number;
  chain_id: number;
  receiver_wallet_address: `0x${string}`;
  expires_at: string;
};

export function PayLinkClient({ code }: { code: string }) {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
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
      const json = (await res.json()) as { session: PublicSession };
      return json.session;
    },
    { refreshInterval: 10_000 },
  );

  const session = data;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "sending" }
    | { type: "sent"; txHash: string }
    | { type: "error"; message: string }
  >({ type: "idle" });

  async function handleConfirmPay() {
    if (!wallet?.address) return;
    setStatus({ type: "sending" });
    try {
      const token = await getAccessToken();
      const prepareRes = await fetch(`/api/sessions/${encodeURIComponent(code)}/prepare`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const prepareBody = (await prepareRes.json().catch(() => null)) as
        | { prepare?: PreparePayload; error?: string; message?: string }
        | null;
      if (!prepareRes.ok) {
        throw new Error(
          prepareBody?.message ?? prepareBody?.error ?? "Could not prepare payment.",
        );
      }
      const prepare = prepareBody?.prepare;
      if (!prepare) {
        throw new Error("Could not prepare payment.");
      }

      await ensureBaseChain(wallet);

      const tx = await simulateUsdcTransfer({
        from: wallet.address as `0x${string}`,
        to: prepare.receiver_wallet_address,
        amount: prepare.amount,
        decimals: prepare.token_decimals,
      });

      const result = await sendTransaction(
        { to: tx.to, data: tx.data },
        { address: wallet.address },
      );

      await fetch(`/api/sessions/${encodeURIComponent(code)}/pay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tx_hash: result.hash }),
      });

      setConfirmOpen(false);
      setStatus({ type: "sent", txHash: result.hash });
      await mutate();
    } catch (err) {
      setConfirmOpen(false);
      setStatus({
        type: "error",
        message: sanitizeTransactionError(err),
      });
    }
  }

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
          <p className="text-xs text-white/60">From</p>
          <p className="mt-1 text-sm font-medium">{session.creator_display_name}</p>

          <p className="mt-4 text-xs text-white/60">Amount</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            {session.amount}{" "}
            <span className="text-base font-medium text-white/70">{session.token}</span>
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
              disabled={!wallet?.address || status.type === "sending" || confirmOpen}
              onClick={() => setConfirmOpen(true)}
              className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#070b14] disabled:opacity-50"
            >
              {`Pay ${session.amount} ${session.token}`}
            </button>
          )}

          <TransactionConfirmModal
            open={confirmOpen}
            title="Confirm payment"
            recipient={session.creator_display_name}
            amount={session.amount}
            token={session.token}
            network="Base"
            confirming={status.type === "sending"}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => void handleConfirmPay()}
          />

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

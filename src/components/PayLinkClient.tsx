"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/AppUI";
import {
  ensureBaseChain,
  sanitizeTransactionError,
  simulateUsdcTransfer,
} from "@/lib/usdcTransferClient";

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

  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "sending" }
    | { type: "sent"; txHash: string }
    | { type: "error"; message: string }
  >({ type: "idle" });

  async function handlePay() {
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

      setStatus({ type: "sent", txHash: result.hash });
      await mutate();
    } catch (err) {
      setStatus({
        type: "error",
        message: sanitizeTransactionError(err),
      });
    }
  }

  if (error) {
    return (
      <main className="screen">
        <div className="mobile-shell flex min-h-dvh items-center justify-center px-6 text-center">
          <section>
            <h1 className="text-[28px] font-bold text-text-primary">Link not found</h1>
            <p className="mt-2 text-base text-text-secondary">
              This payment link may have expired or been removed.
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="screen">
        <div className="mobile-shell flex min-h-dvh items-center justify-center px-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading" />
        </div>
      </main>
    );
  }

  const payable = data.status === "pending";
  const paid = data.status === "paid" || status.type === "sent";

  return (
    <main className="screen">
      <div className="mobile-shell safe-bottom flex min-h-dvh flex-col justify-center px-6 py-10">
        <section className="text-center">
          <p className="text-xl font-semibold text-text-secondary">Payment request</p>
          <div className="cp-card mt-6 p-5">
            <div className="flex flex-col items-center">
              <Avatar seed={data.creator_display_name} size="lg" />
              <h1 className="mt-4 text-xl font-semibold text-text-primary">
                {data.creator_display_name}
              </h1>
              <p className="mt-1 text-base text-text-secondary">is requesting</p>
            </div>
            <p className="mt-6 text-[40px] font-bold leading-none text-text-primary">
              {data.amount} <span className="text-xl font-semibold text-primary">{data.token}</span>
            </p>
            <p className="mt-3 text-xs text-text-muted">Network: Base · Fee: &lt;$0.01</p>
          </div>
        </section>

        {paid ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-success-subtle p-4 text-center text-success">
            <Check className="mx-auto h-6 w-6" />
            <p className="mt-2 text-sm font-semibold">This payment is complete.</p>
          </div>
        ) : !payable ? (
          <div className="mt-6 rounded-xl border border-border bg-background-secondary p-4 text-center">
            <p className="text-sm font-semibold text-text-primary">
              {data.status === "expired"
                ? "This link has expired."
                : "This link is not payable."}
            </p>
            <p className="mt-1 text-sm text-text-secondary">Ask for a new payment link.</p>
          </div>
        ) : !ready ? (
          <div className="mt-6 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !authenticated ? (
          <button
            type="button"
            onClick={() => login({ loginMethods: ["email", "google", "apple"] })}
            className="cp-button cp-button-primary mt-6 w-full"
          >
            Pay Now
          </button>
        ) : (
          <button
            type="button"
            disabled={!wallet?.address || status.type === "sending"}
            onClick={() => void handlePay()}
            className="cp-button cp-button-primary mt-6 w-full"
          >
            {status.type === "sending" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Pay Now"}
          </button>
        )}

        {status.type === "error" ? (
          <p className="mt-3 rounded-xl bg-error-subtle p-3 text-center text-sm text-error">
            {status.message}
          </p>
        ) : null}

        <footer className="mt-8 flex items-center justify-center gap-1.5 text-xs text-text-muted">
          <ShieldCheck className="h-4 w-4" />
          Secured by Privy
        </footer>
      </div>
    </main>
  );
}

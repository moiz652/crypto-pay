"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets, useSendTransaction } from "@privy-io/react-auth";
import { USDC } from "@/lib/usdc";
import {
  ensureBaseChain,
  sanitizeTransactionError,
  simulateUsdcTransfer,
} from "@/lib/usdcTransferClient";
import { TransactionConfirmModal } from "@/components/TransactionConfirmModal";

function normalizeUsername(raw: string) {
  const trimmed = raw.trim().replace(/^@/, "");
  return trimmed.toLowerCase();
}

const LOOKUP_TIMEOUT_MS = 3000;

type ResolvedProfile = {
  wallet_address: `0x${string}`;
  username: string;
  display_name?: string | null;
};

type ResolveState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; profile: ResolvedProfile }
  | { status: "not_found" };

export function SendUsdc({ fromAddress }: { fromAddress?: `0x${string}` }) {
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();

  const wallet = useMemo(() => {
    return wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  }, [wallets]);

  const [toUsername, setToUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "sending" }
    | { type: "sent"; txHash: string }
    | { type: "error"; message: string }
  >({ type: "idle" });

  const username = useMemo(() => normalizeUsername(toUsername), [toUsername]);
  const canLookup = username.length >= 2;

  const [resolveState, setResolveState] = useState<ResolveState>({ status: "idle" });

  useEffect(() => {
    if (!authenticated || !canLookup) {
      setResolveState({ status: "idle" });
      return;
    }

    setResolveState({ status: "loading" });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    let cancelled = false;

    fetch(`/api/users/resolve?username=${encodeURIComponent(username)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setResolveState({ status: "not_found" });
          return;
        }
        const json = (await res.json()) as { profile?: ResolvedProfile };
        if (!json.profile?.wallet_address) {
          setResolveState({ status: "not_found" });
          return;
        }
        setResolveState({ status: "found", profile: json.profile });
      })
      .catch(() => {
        if (!cancelled) {
          setResolveState({ status: "not_found" });
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [authenticated, canLookup, username]);

  const toAddress =
    resolveState.status === "found" ? resolveState.profile.wallet_address : undefined;
  const userNotFound = resolveState.status === "not_found";
  const isLookingUp = resolveState.status === "loading";
  const sameAsSender =
    fromAddress && toAddress && fromAddress.toLowerCase() === toAddress.toLowerCase();

  const canSend =
    Boolean(wallet?.address) &&
    Boolean(toAddress) &&
    Boolean(amount) &&
    /^\d+(\.\d+)?$/.test(amount) &&
    Number(amount) > 0 &&
    !sameAsSender &&
    !userNotFound &&
    !isLookingUp &&
    status.type !== "sending" &&
    !confirmOpen;

  async function handleConfirmSend() {
    if (!wallet?.address || !toAddress || !amount) return;
    setStatus({ type: "sending" });
    try {
      await ensureBaseChain(wallet);

      const tx = await simulateUsdcTransfer({
        from: wallet.address as `0x${string}`,
        to: toAddress,
        amount,
        decimals: USDC.decimals,
      });

      const result = await sendTransaction(
        { to: tx.to, data: tx.data },
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
            to_username:
              resolveState.status === "found" ? resolveState.profile.username : undefined,
            to_wallet_address: toAddress,
            amount,
            tx_hash: result.hash,
          }),
        });
      } catch {
        // Non-blocking for MVP: chain tx is source of truth.
      }
      setConfirmOpen(false);
      setStatus({ type: "sent", txHash: result.hash });
    } catch (err) {
      setConfirmOpen(false);
      setStatus({
        type: "error",
        message: sanitizeTransactionError(err),
      });
    }
  }

  const recipientLabel =
    resolveState.status === "found"
      ? `@${resolveState.profile.username}${
          resolveState.profile.display_name ? ` (${resolveState.profile.display_name})` : ""
        }`
      : "";

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
        {resolveState.status === "found" ? (
          <p>
            Paying <span className="font-mono">@{resolveState.profile.username}</span>
            {resolveState.profile.display_name ? (
              <> ({resolveState.profile.display_name})</>
            ) : null}
          </p>
        ) : isLookingUp ? (
          <p>Looking up recipient…</p>
        ) : userNotFound ? (
          <p className="text-red-300/90">User not found</p>
        ) : null}
        {sameAsSender ? (
          <p className="text-red-300/90">Recipient can’t be your own wallet.</p>
        ) : null}
      </div>

      <button
        type="button"
        disabled={!canSend}
        onClick={() => setConfirmOpen(true)}
        className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#070b14] disabled:opacity-50"
      >
        Send
      </button>

      <TransactionConfirmModal
        open={confirmOpen}
        title="Confirm send"
        recipient={recipientLabel}
        amount={amount}
        token="USDC"
        network="Base"
        confirming={status.type === "sending"}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleConfirmSend()}
      />

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

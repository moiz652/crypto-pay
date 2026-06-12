"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSendTransaction } from "@privy-io/react-auth";
import { Check, Loader2 } from "lucide-react";
import {
  Avatar,
  DetailRow,
  RequireAuth,
  ScreenHeader,
  ToastStack,
  cn,
} from "@/components/AppUI";
import {
  isValidUsername,
  normalizeUsername,
  useCryptoPayAccount,
  useUsdcBalance,
} from "@/lib/clientData";
import { USDC } from "@/lib/usdc";
import {
  ensureBaseChain,
  sanitizeTransactionError,
  simulateUsdcTransfer,
} from "@/lib/usdcTransferClient";

const LOOKUP_TIMEOUT_MS = 3000;

type ResolvedProfile = {
  wallet_address: `0x${string}`;
  username: string;
  display_name?: string | null;
};

type ResolveState =
  | { status: "idle" }
  | { status: "loading"; username: string }
  | { status: "found"; username: string; profile: ResolvedProfile }
  | { status: "not_found"; username: string };

type SendStatus =
  | { type: "idle" }
  | { type: "sending" }
  | { type: "sent"; txHash: string }
  | { type: "error"; message: string };

type Toast = { id: number; message: string; type: "success" | "error" };

export default function SendPage() {
  return (
    <RequireAuth>
      <SendScreen />
    </RequireAuth>
  );
}

function SendScreen() {
  const router = useRouter();
  const { authenticated, getAccessToken, embeddedWallet, address } = useCryptoPayAccount();
  const { display } = useUsdcBalance(address);
  const { sendTransaction } = useSendTransaction();
  const [toUsername, setToUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [resolveState, setResolveState] = useState<ResolveState>({ status: "idle" });
  const [status, setStatus] = useState<SendStatus>({ type: "idle" });
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000);
  }, []);

  const username = useMemo(() => normalizeUsername(toUsername), [toUsername]);
  const canLookup = isValidUsername(username);

  useEffect(() => {
    if (!authenticated || !canLookup) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    let cancelled = false;

    fetch(`/api/users/resolve?username=${encodeURIComponent(username)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setResolveState({ status: "not_found", username });
          return;
        }
        const json = (await res.json()) as { profile?: ResolvedProfile };
        if (!json.profile?.wallet_address) {
          setResolveState({ status: "not_found", username });
          return;
        }
        setResolveState({ status: "found", username, profile: json.profile });
      })
      .catch(() => {
        if (!cancelled) setResolveState({ status: "not_found", username });
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [authenticated, canLookup, username]);

  const displayedResolveState: ResolveState =
    !authenticated || !canLookup
      ? { status: "idle" }
      : "username" in resolveState && resolveState.username === username
        ? resolveState
        : { status: "loading", username };

  const toAddress =
    displayedResolveState.status === "found" ? displayedResolveState.profile.wallet_address : undefined;
  const sameAsSender =
    address && toAddress && address.toLowerCase() === toAddress.toLowerCase();
  const amountValid = Boolean(amount) && /^\d+(\.\d+)?$/.test(amount) && Number(amount) > 0;
  const canReview =
    Boolean(embeddedWallet?.address) &&
    Boolean(toAddress) &&
    amountValid &&
    !sameAsSender &&
    displayedResolveState.status === "found" &&
    status.type !== "sending";

  async function handleSend() {
    if (!embeddedWallet?.address || !toAddress || !amount) return;
    setStatus({ type: "sending" });
    try {
      await ensureBaseChain(embeddedWallet);

      const tx = await simulateUsdcTransfer({
        from: embeddedWallet.address as `0x${string}`,
        to: toAddress,
        amount,
        decimals: USDC.decimals,
      });

      const result = await sendTransaction(
        { to: tx.to, data: tx.data },
        { address: embeddedWallet.address },
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
              displayedResolveState.status === "found" ? displayedResolveState.profile.username : undefined,
            to_wallet_address: toAddress,
            amount,
            tx_hash: result.hash,
          }),
        });
      } catch {
        // Non-blocking for MVP: chain tx is source of truth.
      }

      setStatus({ type: "sent", txHash: result.hash });
      const recipient =
        displayedResolveState.status === "found" ? `@${displayedResolveState.profile.username}` : "recipient";
      addToast(`Sent ${amount} USDC to ${recipient}`, "success");
      setTimeout(() => router.replace("/home"), 1700);
    } catch (err) {
      const msg = sanitizeTransactionError(err);
      setStatus({ type: "error", message: msg });
      addToast(msg, "error");
    }
  }

  const recipientLabel =
    displayedResolveState.status === "found"
      ? displayedResolveState.profile.display_name
        ? `${displayedResolveState.profile.display_name} (@${displayedResolveState.profile.username})`
        : `@${displayedResolveState.profile.username}`
      : "";

  if (status.type === "sent") {
    return (
      <main className="screen">
        <ToastStack toasts={toasts} />
        <div className="mobile-shell flex min-h-dvh flex-col items-center justify-center px-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success-subtle text-success">
            <Check className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-[28px] font-bold text-text-primary">Sent</h1>
          <p className="mt-2 text-base text-text-secondary">
            {amount} USDC is on its way to {recipientLabel}.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <ToastStack toasts={toasts} />
      <div className="mobile-shell safe-bottom animate-screen-in min-h-dvh px-6 py-6">
        <ScreenHeader title="Send" backHref="/home" closeHref="/home" />

        {!reviewing ? (
          <section className="mt-8 space-y-6">
            <div>
              <label className="text-[13px] font-medium text-text-secondary" htmlFor="recipient">
                To
              </label>
              <div className="relative mt-2">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                  @
                </span>
                <input
                  id="recipient"
                  value={toUsername}
                  onChange={(event) => {
                    setToUsername(normalizeUsername(event.target.value));
                    setReviewing(false);
                  }}
                  placeholder="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={cn(
                    "cp-input !pl-10 !pr-10",
                    displayedResolveState.status === "not_found" || sameAsSender ? "cp-input-error" : false,
                  )}
                />
                {displayedResolveState.status === "loading" ? (
                  <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                ) : displayedResolveState.status === "found" && !sameAsSender ? (
                  <Check className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-success" />
                ) : null}
              </div>
              <p className="mt-2 min-h-5 text-sm">
                {displayedResolveState.status === "found" && !sameAsSender ? (
                  <span className="text-success">{recipientLabel}</span>
                ) : displayedResolveState.status === "not_found" ? (
                  <span className="text-error">@{username} not found. Check spelling.</span>
                ) : sameAsSender ? (
                  <span className="text-error">Can&apos;t send to yourself.</span>
                ) : username && !isValidUsername(username) ? (
                  <span className="text-error">Enter a valid username.</span>
                ) : null}
              </p>
            </div>

            <div>
              <label className="text-[13px] font-medium text-text-secondary" htmlFor="amount">
                Amount
              </label>
              <div className="relative mt-2">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                  $
                </span>
                <input
                  id="amount"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setReviewing(false);
                  }}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="cp-input !pl-10 !pr-16"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-text-muted">
                  USDC
                </span>
              </div>
              <p className="mt-2 text-xs text-text-muted">Available: ${display} USDC</p>
            </div>

            <button
              type="button"
              disabled={!canReview}
              onClick={() => setReviewing(true)}
              className="cp-button cp-button-primary w-full"
            >
              Review
            </button>
            {status.type === "error" ? (
              <p className="rounded-xl bg-error-subtle p-3 text-sm text-error">{status.message}</p>
            ) : null}
          </section>
        ) : (
          <section className="mt-8">
            <div className="cp-card p-5">
              <div className="flex flex-col items-center text-center">
                <Avatar seed={recipientLabel} size="lg" />
                <p className="mt-3 text-base font-semibold text-text-primary">{recipientLabel}</p>
                <p className="mt-5 text-[40px] font-bold leading-none text-text-primary">
                  ${amount}
                </p>
                <p className="mt-1 text-sm font-medium text-primary">USDC</p>
              </div>
              <div className="mt-6 space-y-3">
                <DetailRow label="Network fee" value="<$0.01" />
                <DetailRow label="Network" value="Base" />
                <DetailRow label="Total" value={`$${amount} USDC`} />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                disabled={status.type === "sending"}
                onClick={() => void handleSend()}
                className="cp-button cp-button-primary w-full"
              >
                {status.type === "sending" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Confirm & Send"
                )}
              </button>
              <button
                type="button"
                disabled={status.type === "sending"}
                onClick={() => setReviewing(false)}
                className="cp-button cp-button-secondary w-full"
              >
                Cancel
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { usePrivy, useWallets, useSendTransaction } from "@privy-io/react-auth";
import { USDC } from "@/lib/usdc";
import {
  ensureBaseChain,
  sanitizeTransactionError,
  simulateUsdcTransfer,
} from "@/lib/usdcTransferClient";

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

type Toast = {
  id: number;
  message: string;
  type: "success" | "error";
};

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
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

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
    status.type !== "sending";

  async function handleSend() {
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
      setStatus({ type: "sent", txHash: result.hash });
      const recipientLabel = resolveState.status === "found" ? `@${resolveState.profile.username}` : "recipient";
      addToast(`Sent ${amount} USDC to ${recipientLabel}`, "success");
    } catch (err) {
      const msg = sanitizeTransactionError(err);
      setStatus({ type: "error", message: msg });
      addToast(msg, "error");
    }
  }

  const recipientLabel =
    resolveState.status === "found"
      ? `@${resolveState.profile.username}${
          resolveState.profile.display_name ? ` (${resolveState.profile.display_name})` : ""
        }`
      : "";

  if (!authenticated) return null;

  return (
    <>
      {/* Toast notifications */}
      <div className="fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto mx-4 flex items-center gap-2 rounded-xl border px-4 py-3 shadow-lg slide-up ${
              toast.type === "success"
                ? "border-[#00D4AA]/20 bg-[#0F1D18] text-[#00D4AA]"
                : "border-[#FF6B6B]/20 bg-[#1D1010] text-[#FF6B6B]"
            }`}
          >
            {toast.type === "success" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/[0.03] bg-[#151A2E] p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00D4AA]/10">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
          </div>
          <p className="text-sm font-semibold">Send USDC</p>
        </div>
        <p className="mt-1 text-xs text-[#8B95A5]">
          Send on Base using @username
        </p>

        <div className="mt-4 space-y-3">
          {/* Username input */}
          <div>
            <label className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#8B95A5] mb-1.5 block">
              Recipient
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6578] text-sm font-mono">@</span>
              <input
                value={toUsername}
                onChange={(e) => setToUsername(e.target.value)}
                placeholder="username"
                className="w-full rounded-xl border border-[#1E2538] bg-[#0B0F19] pl-7 pr-3 py-2.5 text-sm outline-none placeholder:text-[#5A6578] focus:ring-2 focus:ring-[#00D4AA]/50 focus:border-transparent transition-all"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {isLookingUp && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1E2538] border-t-[#00D4AA]" />
                </div>
              )}
              {resolveState.status === "found" && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              )}
            </div>

            {/* Lookup status */}
            <div className="mt-1.5 min-h-[18px]">
              {resolveState.status === "found" ? (
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00D4AA]/10 text-[10px] font-semibold text-[#00D4AA]">
                    {resolveState.profile.username[0].toUpperCase()}
                  </div>
                  <p className="text-xs text-[#00D4AA]">
                    {resolveState.profile.display_name
                      ? `${resolveState.profile.display_name} (@${resolveState.profile.username})`
                      : `@${resolveState.profile.username}`}
                  </p>
                </div>
              ) : userNotFound ? (
                <p className="text-xs text-[#FF6B6B]">User not found</p>
              ) : sameAsSender ? (
                <p className="text-xs text-[#FF6B6B]">Can&apos;t send to yourself</p>
              ) : null}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#8B95A5] mb-1.5 block">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6578] text-sm">$</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="w-full rounded-xl border border-[#1E2538] bg-[#0B0F19] pl-7 pr-14 py-2.5 text-sm outline-none placeholder:text-[#5A6578] focus:ring-2 focus:ring-[#00D4AA]/50 focus:border-transparent transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#5A6578]">USDC</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={!canSend}
          onClick={() => void handleSend()}
          className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#070b14] hover:scale-105 hover:brightness-110 transition-all disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
        >
          {status.type === "sending" ? (
            <div className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#070b14]/30 border-t-[#070b14]" />
              Sending…
            </div>
          ) : (
            "Send"
          )}
        </button>
      </div>
    </>
  );
}
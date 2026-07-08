"use client";

import { useEffect, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import useSWR from "swr";
import { formatUnits } from "viem";
import { publicClient } from "@/lib/viem";
import { erc20Abi, USDC } from "@/lib/usdc";

export type Profile = {
  id: string;
  username: string | null;
  wallet_address: string | null;
  display_name?: string | null;
  acknowledged_irreversibility_at?: string | null;
};

export type SentTransfer = {
  created_at: string;
  to_username: string | null;
  to_wallet_address: string;
  amount: string;
  token_symbol: string;
  tx_hash: string;
};

export type PaymentRequest = {
  created_at: string;
  short_code: string;
  amount: string;
  token_symbol: string;
  status: string;
  payer_tx_hash: string | null;
  expires_at?: string;
};

export type ActivityPayload = {
  sentTransfers: SentTransfer[];
  myRequests: PaymentRequest[];
  receivedRequests: PaymentRequest[];
};

export type ActivityItem = {
  id: string;
  type: "sent" | "received" | "request";
  createdAt: string;
  title: string;
  subtitle: string;
  amount: string;
  token: string;
  status?: string;
  txHash?: string | null;
  href: string;
  shortCode?: string;
};

export function normalizeUsername(raw: string) {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

export function isValidUsername(value: string) {
  return /^[a-z0-9_]{2,32}$/i.test(value);
}

export function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatFullDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── localStorage key for username cache ─────────────────────────────────────
// Keyed by Privy user ID so multi-account devices work correctly.
function usernameCacheKey(userId: string) {
  return `cp_u_${userId}`;
}

export function useCryptoPayAccount() {
  const privy = usePrivy();
  const { wallets } = useWallets();

  const embeddedWallet = useMemo(() => {
    return wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  }, [wallets]);

  const address = embeddedWallet?.address as `0x${string}` | undefined;

  // ── Read cached username synchronously on mount ───────────────────────────
  // This means returning users see @username immediately — zero flicker —
  // while the fresh profile fetch revalidates in the background.
  const userId = privy.user?.id ?? null;
  const cachedUsername = useMemo<string | null>(() => {
    if (!userId || typeof window === "undefined") return null;
    return window.localStorage.getItem(usernameCacheKey(userId)) ?? null;
  }, [userId]);

  // ── SWR key ───────────────────────────────────────────────────────────────
  // Keyed on [userId, address]. When address is undefined on first render,
  // key is ["profileSync", userId, ""] — this fires once immediately.
  // When the wallet loads and address becomes real, key changes to
  // ["profileSync", userId, "0x..."] — this fires once more with the
  // correct wallet address so Supabase gets it recorded.
  // Two total fetches per session — that's intentional and correct.
  const swrKey =
    privy.ready && privy.authenticated && userId
      ? ["profileSync", userId, address ?? ""]
      : null;

  const {
    data: profileSync,
    mutate: mutateProfile,
    isLoading: profileLoading,
    error: profileError,
  } = useSWR(
    swrKey,
    async () => {
      // ── Hard 8-second timeout ───────────────────────────────────────────
      // Without this, privy.getAccessToken() can hang on Privy cold start
      // or a slow JWT refresh, causing the profile to be "loading" for
      // ~54 seconds until Vercel's serverless function times out.
      // After 8s we abort, SWR shows an error, and the UI falls back to
      // the localStorage cache (returning users) or email (new users).
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8_000);

      try {
        const token = await privy.getAccessToken();
        const res = await fetch("/api/profile/sync", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ wallet_address: address }),
        });
        if (!res.ok) throw new Error("profile_sync_failed");
        return res.json() as Promise<{ profile: Profile }>;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    {
      revalidateOnFocus: false,
      // On failure: retry once after 3 seconds, then give up.
      // This handles transient cold-start failures without an infinite loop.
      errorRetryCount: 1,
      errorRetryInterval: 3_000,
    },
  );

  const profile = profileSync?.profile ?? null;
  const freshUsername = profile?.username?.trim() || null;
  const displayName = profile?.display_name?.trim() || null;
  const email = privy.user?.email?.address ?? null;
  const phone = privy.user?.phone?.number ?? null;

  // ── Persist username to localStorage when it arrives ─────────────────────
  useEffect(() => {
    if (freshUsername && userId) {
      window.localStorage.setItem(usernameCacheKey(userId), freshUsername);
    }
  }, [freshUsername, userId]);

  // ── Merge fresh + cached ──────────────────────────────────────────────────
  // freshUsername: from the live API call (null while loading or on error)
  // cachedUsername: from localStorage (available synchronously on mount)
  // Result: username is always the most up-to-date known value, never null
  // for a returning user even during the background revalidation.
  const username = freshUsername ?? cachedUsername;

  return {
    ...privy,
    wallets,
    embeddedWallet,
    address,
    profile,
    username,
    displayName,
    email,
    phone,
    mutateProfile,
    profileLoading,
    profileError,
  };
}

export function useUsdcBalance(address?: `0x${string}`) {
  const { data, error, isLoading, mutate } = useSWR(
    address ? ["usdcBalance", address] : null,
    async () => {
      const bal = await publicClient.readContract({
        address: USDC.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address!],
      });
      return bal;
    },
    { refreshInterval: 15_000 },
  );

  const formatted = Number(formatUnits(data ?? BigInt(0), USDC.decimals));
  const display = formatted.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return { balance: data ?? BigInt(0), formatted, display, error, isLoading, mutate };
}

export function useActivity() {
  const { ready, authenticated, getAccessToken } = usePrivy();

  return useSWR(
    ready && authenticated ? ["activity"] : null,
    async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/activity", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("activity_failed");
      return res.json() as Promise<ActivityPayload>;
    },
    { refreshInterval: 15_000 },
  );
}

export function normalizeActivity(activity?: ActivityPayload | null): ActivityItem[] {
  if (!activity) return [];

  const sent: ActivityItem[] = (activity.sentTransfers ?? []).map((t) => ({
    id: t.tx_hash,
    type: "sent",
    createdAt: t.created_at,
    title: t.to_username ? `@${t.to_username}` : "Sent payment",
    subtitle: formatDate(t.created_at),
    amount: `-${t.amount}`,
    token: t.token_symbol,
    status: "sent",
    txHash: t.tx_hash,
    href: `/activity/${encodeURIComponent(t.tx_hash)}`,
  }));

  const requests: ActivityItem[] = (activity.myRequests ?? []).map((r) => ({
    id: r.short_code,
    type: "request",
    createdAt: r.created_at,
    title: "Payment request",
    subtitle: `${formatDate(r.created_at)} · ${humanStatus(r.status)}`,
    amount: r.amount,
    token: r.token_symbol,
    status: r.status,
    txHash: r.payer_tx_hash,
    shortCode: r.short_code,
    href: `/activity/${encodeURIComponent(r.short_code)}`,
  }));

  const received: ActivityItem[] = (activity.receivedRequests ?? []).map((r) => {
    const paid = r.status === "paid";

    return {
      id: `${r.short_code}-${paid ? "received" : "incoming"}`,
      type: paid ? "received" : "request",
      createdAt: r.created_at,
      title: paid ? "Payment received" : "Incoming request",
      subtitle: `${formatDate(r.created_at)} · ${humanStatus(r.status)}`,
      amount: paid ? `+${r.amount}` : r.amount,
      token: r.token_symbol,
      status: r.status,
      txHash: r.payer_tx_hash,
      shortCode: r.short_code,
      href: `/activity/${encodeURIComponent(r.short_code)}`,
    };
  });

  return [...sent, ...requests, ...received].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function findActivityItem(activity: ActivityPayload | undefined, id: string) {
  const decoded = decodeURIComponent(id);
  return normalizeActivity(activity).find(
    (item) =>
      item.id === decoded ||
      item.txHash === decoded ||
      item.shortCode === decoded ||
      item.id === `${decoded}-received` ||
      item.id === `${decoded}-incoming`,
  );
}

export function humanStatus(status?: string) {
  if (!status) return "";
  return status.slice(0, 1).toUpperCase() + status.slice(1);
}
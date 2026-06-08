"use client";

import { useMemo, useState, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { formatUnits } from "viem";
import useSWR from "swr";
import { publicClient } from "@/lib/viem";
import { erc20Abi, USDC } from "@/lib/usdc";
import { UsernameForm } from "@/components/UsernameForm";
import { SendUsdc } from "@/components/SendUsdc";
import { RequestLink } from "@/components/RequestLink";

export default function Home() {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!privyAppId) {
    return (
      <main className="min-h-dvh bg-[#0B0F19] text-[#F0F2F5]">
        <div className="mx-auto max-w-md px-6 py-10">
          <div className="rounded-2xl border border-white/[0.03] bg-[#151A2E] p-5">
            <p className="text-sm font-semibold">Missing Privy configuration</p>
            <p className="mt-2 text-xs text-[#8B95A5]">
              Set <span className="font-mono">NEXT_PUBLIC_PRIVY_APP_ID</span> in{" "}
              <span className="font-mono">.env.local</span>, then restart the dev
              server.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return <AuthedHome />;
}

function AuthedHome() {
  const { ready, authenticated, user, login, logout, getAccessToken } =
    usePrivy();
  const { wallets } = useWallets();

  const embeddedWallet = useMemo(() => {
    return wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  }, [wallets]);

  const address = embeddedWallet?.address as `0x${string}` | undefined;

  const {
    data: profileSync,
    mutate: mutateProfile,
    isLoading: profileLoading,
  } = useSWR(
    ready && authenticated
      ? ["profileSync", address ?? "", user?.id ?? ""]
      : null,
    async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/profile/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          wallet_address: address,
        }),
      });
      if (!res.ok) throw new Error("profile_sync_failed");
      return res.json() as Promise<{
        profile: { id: string; username: string | null; wallet_address: string | null };
      }>;
    },
    { revalidateOnFocus: false },
  );

  const username = profileSync?.profile?.username?.trim() || null;

  const { data: usdcBalance } = useSWR(
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

  const { data: activity } = useSWR(
    ready && authenticated ? ["activity"] : null,
    async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/activity", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("activity_failed");
      return res.json() as Promise<{
        sentTransfers: Array<{
          created_at: string;
          to_username: string | null;
          to_wallet_address: string;
          amount: string;
          token_symbol: string;
          tx_hash: string;
        }>;
        myRequests: Array<{
          created_at: string;
          short_code: string;
          amount: string;
          token_symbol: string;
          status: string;
          payer_tx_hash: string | null;
        }>;
        receivedRequests: Array<{
          created_at: string;
          short_code: string;
          amount: string;
          token_symbol: string;
          status: string;
          payer_tx_hash: string | null;
        }>;
      }>;
    },
    { refreshInterval: 15_000 },
  );

  const hasActivity = Boolean(
    activity?.sentTransfers?.length ||
    activity?.myRequests?.length ||
    activity?.receivedRequests?.length
  );

  const balance = Number(
    formatUnits(usdcBalance ?? BigInt(0), USDC.decimals),
  ).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <main className="min-h-dvh bg-[#0B0F19] text-[#F0F2F5]">
      <div className="mx-auto max-w-md px-6 py-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#151A2E] border border-[#1E2538]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight">Crypto Pay</span>
          </div>
          {ready && authenticated ? (
            <UserMenu user={user} username={username} logout={logout} />
          ) : null}
        </header>

        {/* Balance Card */}
        <section className="mt-8 rounded-2xl border border-white/[0.03] bg-[#151A2E] p-5">
          {!ready ? (
            <div className="space-y-3">
              <div className="h-3 w-20 rounded bg-white/5 animate-pulse" />
              <div className="h-9 w-36 rounded bg-white/5 animate-pulse" />
            </div>
          ) : !authenticated ? (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Welcome to Crypto Pay</h1>
                <p className="mt-1 text-sm text-[#8B95A5]">
                  Sign in with email or phone. We&apos;ll create your wallet in the background.
                </p>
              </div>
              <button
                type="button"
                onClick={login}
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#070b14] hover:scale-105 hover:brightness-110 transition-all"
              >
                Sign in
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Identity */}
              <div className="flex items-center justify-between">
                <div>
                  {username ? (
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold tracking-tight font-mono text-[#00D4AA]">@{username}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-[#8B95A5]">
                      {user?.email?.address ?? user?.phone?.number ?? "Connected"}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-[#00D4AA]/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#00D4AA]">
                  Base
                </span>
              </div>

              {/* Balance */}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#8B95A5]">Balance</p>
                <p className="mt-1 text-4xl font-semibold tracking-tight">
                  ${balance}
                  <span className="ml-1.5 text-base font-medium text-[#8B95A5]">USDC</span>
                </p>
              </div>

              {/* Wallet with copy */}
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono text-[#5A6578] truncate max-w-[200px]">
                  {address ?? "—"}
                </p>
                {address && (
                  <CopyButton text={address} />
                )}
              </div>

              {/* Add funds hint when zero balance */}
              {balance === "0" && (
                <div className="rounded-xl bg-[#00D4AA]/5 border border-[#00D4AA]/10 p-3">
                  <p className="text-xs text-[#8B95A5]">
                    Your wallet is empty. Add USDC on Base to start sending.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Username onboarding (only if no username yet) */}
        {authenticated && !profileLoading && !username && (
          <section className="mt-6">
            <div className="rounded-2xl border border-[#00D4AA]/20 bg-[#00D4AA]/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00D4AA]/10">
                  <span className="text-sm font-semibold text-[#00D4AA]">1</span>
                </div>
                <div>
                  <p className="text-sm font-semibold">Choose your username</p>
                  <p className="mt-0.5 text-xs text-[#8B95A5]">
                    People can pay you with @username
                  </p>
                </div>
              </div>
              <div className="mt-3 pl-11">
                <UsernameForm onSaved={() => void mutateProfile()} />
              </div>
            </div>
          </section>
        )}

        {/* First-time 3-step intro */}
        {authenticated && username && balance === "0" && (
          <section className="mt-6 rounded-2xl border border-white/[0.03] bg-[#151A2E] p-5 stagger-children">
            <p className="text-sm font-semibold">Getting started</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00D4AA]/10">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">Wallet created</p>
                  <p className="text-xs text-[#8B95A5]">Your embedded wallet is ready</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00D4AA]/10">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">Username claimed</p>
                  <p className="text-xs text-[#8B95A5]">@{username} is yours</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 border border-[#1E2538]">
                  <span className="text-xs font-semibold text-[#8B95A5]">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#F0F2F5]">Add USDC</p>
                  <p className="text-xs text-[#8B95A5]">Send USDC on Base to your wallet to start</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Send & Request */}
        {authenticated && (
          <div className="mt-6 space-y-4">
            <SendUsdc fromAddress={address} />
            <RequestLink />
          </div>
        )}

        {/* Activity */}
        {authenticated && (
          <section className="mt-6 rounded-2xl border border-white/[0.03] bg-[#151A2E] p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#8B95A5]">Activity</p>
              {hasActivity && (
                <span className="text-[11px] text-[#5A6578]">
                  {(activity?.sentTransfers?.length ?? 0) + (activity?.myRequests?.length ?? 0) + (activity?.receivedRequests?.length ?? 0)} items
                </span>
              )}
            </div>

            {hasActivity ? (
              <div className="mt-4 space-y-4">
                {/* Sent transfers */}
                {activity?.sentTransfers && activity.sentTransfers.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#5A6578] mb-2">Sent</p>
                    <div className="space-y-2">
                      {activity.sentTransfers.slice(0, 5).map((t) => (
                        <div key={t.tx_hash} className="flex items-center justify-between rounded-xl bg-white/[0.02] p-3 border border-white/[0.02] hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6B6B]/10">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 19V5M5 12l7-7 7 7"/>
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {t.to_username ? `@${t.to_username}` : truncateAddress(t.to_wallet_address)}
                              </p>
                              <p className="text-[11px] text-[#5A6578]">
                                {formatDate(t.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-[#FF6B6B]">-{t.amount} {t.token_symbol}</p>
                            <a
                              href={`https://basescan.org/tx/${t.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-[#5A6578] hover:text-[#00D4AA] transition-colors"
                            >
                              View →
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Created requests */}
                {activity?.myRequests && activity.myRequests.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#5A6578] mb-2">Requests</p>
                    <div className="space-y-2">
                      {activity.myRequests.slice(0, 3).map((r) => (
                        <div key={r.short_code} className="flex items-center justify-between rounded-xl bg-white/[0.02] p-3 border border-white/[0.02] hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00D4AA]/10">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Request link</p>
                              <p className="text-[11px] text-[#5A6578]">
                                {formatDate(r.created_at)} · {r.status}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{r.amount} {r.token_symbol}</p>
                            <p className="text-[11px] font-mono text-[#5A6578]">/{r.short_code}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Received payments */}
                {activity?.receivedRequests && activity.receivedRequests.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#5A6578] mb-2">Received</p>
                    <div className="space-y-2">
                      {activity.receivedRequests.slice(0, 3).map((r) => (
                        <div key={r.short_code} className="flex items-center justify-between rounded-xl bg-white/[0.02] p-3 border border-white/[0.02] hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00D4AA]/10">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14M5 12l7 7 7-7"/>
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Payment received</p>
                              <p className="text-[11px] text-[#5A6578]">
                                {formatDate(r.created_at)} · {r.status}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-[#00D4AA]">+{r.amount} {r.token_symbol}</p>
                            {r.payer_tx_hash && (
                              <a
                                href={`https://basescan.org/tx/${r.payer_tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-[#5A6578] hover:text-[#00D4AA] transition-colors"
                              >
                                View →
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-8 flex flex-col items-center py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] border border-[#1E2538]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5A6578" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                </div>
                <p className="mt-3 text-sm font-medium text-[#8B95A5]">No transactions yet</p>
                <p className="mt-1 text-xs text-[#5A6578] text-center">
                  Send USDC or create a request to see activity here.
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

/* User dropdown menu */
function UserMenu({
  user,
  username,
  logout,
}: {
  user: ReturnType<typeof usePrivy>["user"];
  username: string | null;
  logout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const email = user?.email?.address;
  const phone = user?.phone?.number;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#151A2E] border border-[#1E2538] hover:border-white/20 transition-colors"
      >
        <span className="text-xs font-semibold text-[#F0F2F5]">
          {username ? username[0].toUpperCase() : (email ? email[0].toUpperCase() : "U")}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-[#1E2538] bg-[#151A2E] p-3 shadow-xl slide-up">
            <div className="px-2 py-1.5">
              {username && (
                <p className="text-sm font-semibold font-mono text-[#00D4AA]">@{username}</p>
              )}
              {email && (
                <p className="text-xs text-[#8B95A5] truncate">{email}</p>
              )}
              {phone && !email && (
                <p className="text-xs text-[#8B95A5]">{phone}</p>
              )}
            </div>
            <div className="mt-1 border-t border-[#1E2538] pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="w-full rounded-xl px-2 py-2 text-left text-sm text-[#FF6B6B] hover:bg-white/[0.03] transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* Copy button */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-lg p-1.5 hover:bg-white/[0.05] transition-colors"
      title="Copy address"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5A6578" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      )}
    </button>
  );
}

/* Utils */
function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDate(iso: string) {
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
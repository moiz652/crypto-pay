"use client";

import { useMemo } from "react";
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
      <main className="min-h-dvh bg-[#070b14] text-white">
        <div className="mx-auto max-w-md px-6 py-10">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold">Missing Privy configuration</p>
            <p className="mt-2 text-xs text-white/70">
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

  return (
    <main className="min-h-dvh bg-[#070b14] text-white">
      <div className="mx-auto max-w-md px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/60">Crypto Pay</p>
            <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
          </div>
          {ready && authenticated ? (
            <button
              type="button"
              onClick={logout}
              className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
            >
              Log out
            </button>
          ) : null}
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
          {!ready ? (
            <p className="text-sm text-white/70">Loading…</p>
          ) : !authenticated ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-white/70">
                Sign in with email or phone. We’ll create your wallet in the background.
              </p>
              <button
                type="button"
                onClick={login}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#070b14] hover:bg-white/90"
              >
                Sign in
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-white/60">Signed in as</p>
                <p className="text-sm font-medium">
                  {username ? (
                    <span className="font-mono">@{username}</span>
                  ) : (
                    (user?.email?.address ?? user?.phone?.number ?? user?.id)
                  )}
                </p>
              </div>

              {!profileLoading && !username ? (
                <UsernameForm onSaved={() => void mutateProfile()} />
              ) : null}
              <SendUsdc fromAddress={address} />
              <RequestLink />

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold">Activity</p>
                <div className="mt-2 space-y-2 text-xs text-white/70">
                  {activity?.sentTransfers?.length ? (
                    <div>
                      <p className="text-xs text-white/50">Sent</p>
                      {activity.sentTransfers.slice(0, 3).map((t) => (
                        <p key={t.tx_hash} className="break-all">
                          {t.amount} {t.token_symbol} →{" "}
                          <span className="font-mono">
                            {t.to_username ? `@${t.to_username}` : t.to_wallet_address}
                          </span>
                        </p>
                      ))}
                    </div>
                  ) : null}

                  {activity?.myRequests?.length ? (
                    <div>
                      <p className="text-xs text-white/50">Requests you created</p>
                      {activity.myRequests.slice(0, 3).map((r) => (
                        <p key={r.short_code}>
                          {r.amount} {r.token_symbol} · {r.status} ·{" "}
                          <span className="font-mono">/s/{r.short_code}</span>
                        </p>
                      ))}
                    </div>
                  ) : null}

                  {activity?.receivedRequests?.length ? (
                    <div>
                      <p className="text-xs text-white/50">Requests paid to you</p>
                      {activity.receivedRequests.slice(0, 3).map((r) => (
                        <p key={r.short_code}>
                          {r.amount} {r.token_symbol} · {r.status} ·{" "}
                          <span className="font-mono">/s/{r.short_code}</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-white/40">No activity yet.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-white/60">Wallet</p>
                <p className="text-sm font-mono break-all">{address ?? "—"}</p>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-white/60">Balance</p>
                  <p className="text-3xl font-semibold tracking-tight">
                    {Number(
                      formatUnits(usdcBalance ?? BigInt(0), USDC.decimals),
                    ).toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                    <span className="text-base font-medium text-white/70">USDC</span>
                  </p>
                </div>
                <p className="text-xs text-white/50">Base</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

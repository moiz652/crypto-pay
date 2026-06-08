"use client";

import Link from "next/link";
import { CreditCard, UserRound, Wallet } from "lucide-react";
import {
  CopyButton,
  ProgressDots,
  RequireAuth,
  ScreenHeader,
} from "@/components/AppUI";
import { useCryptoPayAccount, truncateAddress } from "@/lib/clientData";

export default function FundsOnboardingPage() {
  return (
    <RequireAuth>
      <FundsOnboarding />
    </RequireAuth>
  );
}

function FundsOnboarding() {
  const { username, address } = useCryptoPayAccount();

  return (
    <main className="screen">
      <div className="mobile-shell safe-bottom animate-screen-in min-h-dvh px-6">
        <ScreenHeader title="" backHref="/onboarding/username" />
        <ProgressDots active={3} />

        <section className="mt-10">
          <h1 className="text-[28px] font-bold leading-tight text-text-primary">
            Add USDC to start sending
          </h1>
          <p className="mt-3 text-base leading-6 text-text-secondary">
            Add funds when you are ready, or skip and explore CryptoPay first.
          </p>
        </section>

        <div className="mt-8 space-y-3">
          <div className="cp-card flex items-center gap-3 p-4 opacity-70">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background-secondary text-text-secondary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-text-primary">Buy with card</p>
              <p className="text-sm text-text-secondary">Add USDC using a card</p>
            </div>
            <span className="rounded-full bg-primary-subtle px-2.5 py-1 text-xs font-medium text-primary">
              Coming soon
            </span>
          </div>

          <div className="cp-card flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-subtle text-primary">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-text-primary">Receive from a friend</p>
              <p className="truncate text-sm text-text-secondary">
                {username ? `Share @${username}` : "Share your username later"}
              </p>
            </div>
            {username ? <CopyButton text={`@${username}`} label="Copy username" /> : null}
          </div>

          <div className="cp-card flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-subtle text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-text-primary">Copy wallet address</p>
              <p className="truncate font-mono text-sm text-text-secondary">
                {address ? truncateAddress(address) : "Wallet loading"}
              </p>
            </div>
            {address ? <CopyButton text={address} label="Copy wallet address" /> : null}
          </div>
        </div>

        <Link href="/home" className="cp-button cp-button-primary mt-8 w-full">
          Continue to home
        </Link>
        <Link href="/home" className="cp-button mt-3 w-full text-primary">
          Skip for now
        </Link>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { WalletCards } from "lucide-react";
import { ProgressDots, RequireAuth } from "@/components/AppUI";

export default function WalletOnboardingPage() {
  return (
    <RequireAuth>
      <main className="screen">
        <div className="mobile-shell safe-bottom flex min-h-dvh flex-col justify-center px-6">
          <ProgressDots active={1} />
          <div className="mt-12 text-center">
            <div className="animate-pulse-scale mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-subtle text-primary">
              <WalletCards className="h-9 w-9" />
            </div>
            <h1 className="mt-8 text-[28px] font-bold leading-tight text-text-primary">
              Your wallet is ready
            </h1>
            <p className="mt-3 text-base leading-6 text-text-secondary">
              CryptoPay created a secure wallet for you in the background. No seed phrases,
              no setup steps, and no technical details to manage.
            </p>
          </div>

          <Link href="/onboarding/username" className="cp-button cp-button-primary mt-10 w-full">
            Continue
          </Link>
        </div>
      </main>
    </RequireAuth>
  );
}

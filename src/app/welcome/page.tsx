"use client";

import { useEffect } from "react";
import { Apple, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { LoadingScreen, MissingPrivyConfig } from "@/components/AppUI";
import { useCryptoPayAccount } from "@/lib/clientData";

export default function WelcomePage() {
  const router = useRouter();
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const { ready, authenticated, login, username, profileLoading } = useCryptoPayAccount();

  useEffect(() => {
    if (!ready || !authenticated || profileLoading) return;
    router.replace(username ? "/home" : "/onboarding/wallet");
  }, [authenticated, profileLoading, ready, router, username]);

  if (!privyAppId) return <MissingPrivyConfig />;
  if (!ready) return <LoadingScreen />;

  return (
    <main className="screen">
      <div className="mobile-shell flex min-h-dvh flex-col justify-center px-6 py-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white">
          C
        </div>

        <section className="mt-10 text-center">
          <h1 className="mx-auto max-w-80 text-[28px] font-bold leading-tight text-text-primary">
            Send money to anyone, instantly.
          </h1>
          <p className="mx-auto mt-3 max-w-80 text-base leading-6 text-text-secondary">
            No bank account. No wallet address. Just a username.
          </p>
        </section>

        <div className="mt-10 space-y-3">
          <button
            type="button"
            onClick={() => login({ loginMethods: ["google"] })}
            className="cp-button cp-button-secondary w-full"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs font-bold text-primary">
              G
            </span>
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => login({ loginMethods: ["apple"] })}
            className="cp-button cp-button-secondary w-full"
          >
            <Apple className="h-5 w-5" />
            Continue with Apple
          </button>
          <button
            type="button"
            onClick={() => login({ loginMethods: ["email"] })}
            className="cp-button cp-button-secondary w-full"
          >
            <Mail className="h-5 w-5" />
            Continue with Email
          </button>
        </div>

        <footer className="mt-10 flex items-center justify-center gap-1.5 text-xs text-text-muted">
          <ShieldCheck className="h-4 w-4" />
          Secured by Privy
        </footer>
      </div>
    </main>
  );
}

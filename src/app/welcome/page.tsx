"use client";

import { useEffect, useState } from "react";
import { useLoginWithEmail, useLoginWithOAuth } from "@privy-io/react-auth";
import { Apple, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { LoadingScreen, MissingPrivyConfig } from "@/components/AppUI";
import { useCryptoPayAccount } from "@/lib/clientData";

type EmailStep = "closed" | "email" | "code";

export default function WelcomePage() {
  const router = useRouter();
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const { ready, authenticated, username, profileLoading } = useCryptoPayAccount();
  const { initOAuth, loading: oauthLoading } = useLoginWithOAuth();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const [emailStep, setEmailStep] = useState<EmailStep>("closed");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!ready || !authenticated || profileLoading) return;
    if (!username) {
      router.replace("/onboarding/wallet");
      return;
    }

    const postLoginPath = window.sessionStorage.getItem("cryptopay-post-login");
    if (postLoginPath?.startsWith("/") && !postLoginPath.startsWith("//")) {
      window.sessionStorage.removeItem("cryptopay-post-login");
      router.replace(postLoginPath);
      return;
    }

    router.replace("/home");
  }, [authenticated, profileLoading, ready, router, username]);

  async function handleGoogleLogin() {
    setAuthError("");
    await initOAuth({ provider: "google" }).catch(() => {
      setAuthError("Could not start Google sign-in. Try again.");
    });
  }

  async function handleEmailCode() {
    if (!email.trim()) {
      setEmailStep("email");
      return;
    }

    setAuthError("");
    setEmailLoading(true);
    try {
      await sendCode({ email: email.trim() });
      setEmailStep("code");
    } catch {
      setAuthError("Could not send the email code. Try again.");
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleCodeLogin() {
    if (!code.trim()) return;

    setAuthError("");
    setEmailLoading(true);
    try {
      await loginWithCode({ code: code.trim() });
    } catch {
      setAuthError("That code did not work. Check it and try again.");
    } finally {
      setEmailLoading(false);
    }
  }

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
            disabled={oauthLoading}
            onClick={() => void handleGoogleLogin()}
            className="cp-button cp-button-secondary w-full"
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <button
            type="button"
            disabled
            className="cp-button cp-button-secondary w-full !justify-between opacity-50 cursor-not-allowed"
          >
            <span className="flex items-center gap-2">
              <Apple className="h-5 w-5" />
              <span>Continue with Apple</span>
            </span>
            <span className="rounded-full bg-[#E2E8F0] px-2 py-0.5 text-[10px] font-medium text-[#475569]">
              Coming soon
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthError("");
              setEmailStep((current) => (current === "closed" ? "email" : "closed"));
            }}
            className="cp-button cp-button-secondary w-full"
          >
            <Mail className="h-5 w-5" />
            Continue with Email
          </button>
        </div>

        {emailStep !== "closed" ? (
          <section className="mt-4 space-y-3" aria-label="Email sign in">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              className="cp-input"
            />
            {emailStep === "code" ? (
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="cp-input"
              />
            ) : null}
            <button
              type="button"
              disabled={emailLoading || (emailStep === "code" ? !code.trim() : !email.trim())}
              onClick={() => void (emailStep === "code" ? handleCodeLogin() : handleEmailCode())}
              className="cp-button cp-button-primary w-full"
            >
              {emailStep === "code" ? "Verify Code" : "Send Code"}
            </button>
          </section>
        ) : null}

        {authError ? (
          <p className="mt-4 rounded-xl bg-error-subtle p-3 text-center text-sm text-error">
            {authError}
          </p>
        ) : null}

        <footer className="mt-10 flex items-center justify-center gap-1.5 text-xs text-text-muted">
          <ShieldCheck className="h-4 w-4" />
          Secured by Privy
        </footer>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.79Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-3a7.24 7.24 0 0 1-10.78-3.8H1.31v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.29a7.21 7.21 0 0 1 0-4.58V6.62H1.31a12 12 0 0 0 0 10.76l3.99-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.43-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.31 6.62L5.3 9.71A7.15 7.15 0 0 1 12 4.75Z"
      />
    </svg>
  );
}

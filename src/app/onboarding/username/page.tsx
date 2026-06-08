"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { ProgressDots, RequireAuth, ScreenHeader, cn } from "@/components/AppUI";
import { isValidUsername, normalizeUsername, useCryptoPayAccount } from "@/lib/clientData";

type Availability =
  | { type: "idle" }
  | { type: "invalid" }
  | { type: "checking"; username: string }
  | { type: "available"; username: string }
  | { type: "taken"; username: string }
  | { type: "error"; username: string };

export default function UsernameOnboardingPage() {
  return (
    <RequireAuth>
      <UsernameOnboarding />
    </RequireAuth>
  );
}

function UsernameOnboarding() {
  const router = useRouter();
  const { getAccessToken, mutateProfile } = useCryptoPayAccount();
  const [value, setValue] = useState("");
  const [availability, setAvailability] = useState<Availability>({ type: "idle" });
  const [saving, setSaving] = useState(false);

  const normalized = useMemo(() => normalizeUsername(value), [value]);
  const valid = isValidUsername(normalized);

  useEffect(() => {
    if (!normalized || !valid) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setAvailability({ type: "checking", username: normalized });
      fetch(`/api/users/resolve?username=${encodeURIComponent(normalized)}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (res.status === 404) {
            setAvailability({ type: "available", username: normalized });
            return;
          }
          setAvailability(
            res.ok
              ? { type: "taken", username: normalized }
              : { type: "error", username: normalized },
          );
        })
        .catch(() => setAvailability({ type: "error", username: normalized }));
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [normalized, valid]);

  const displayedAvailability: Availability = !normalized
    ? { type: "idle" }
    : !valid
      ? { type: "invalid" }
      : "username" in availability && availability.username === normalized
        ? availability
        : { type: "checking", username: normalized };

  async function claimUsername() {
    if (displayedAvailability.type !== "available" || saving) return;
    setSaving(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/profile/username", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: normalized }),
      });
      if (res.status === 409) {
        setAvailability({ type: "taken", username: normalized });
        return;
      }
      if (!res.ok) {
        setAvailability({ type: "error", username: normalized });
        return;
      }
      await mutateProfile();
      router.push("/onboarding/funds");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="screen">
      <div className="mobile-shell safe-bottom animate-screen-in min-h-dvh px-6">
        <ScreenHeader title="" backHref="/onboarding/wallet" />
        <ProgressDots active={2} />

        <section className="mt-10">
          <h1 className="text-[28px] font-bold leading-tight text-text-primary">
            Choose your @username
          </h1>
          <p className="mt-3 text-base leading-6 text-text-secondary">
            This is how people find you and send you money.
          </p>
        </section>

        <div className="mt-8">
          <label className="text-[13px] font-medium text-text-secondary" htmlFor="username">
            Username
          </label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
              @
            </span>
            <input
              id="username"
              value={value}
              onChange={(event) => setValue(normalizeUsername(event.target.value))}
              placeholder="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={cn(
                "cp-input px-9",
                displayedAvailability.type === "taken" || displayedAvailability.type === "error"
                  ? "cp-input-error"
                  : false,
              )}
            />
            <StatusIcon availability={displayedAvailability} />
          </div>
          <p className={cn("mt-2 min-h-5 text-sm", statusClass(displayedAvailability))}>
            {statusText(displayedAvailability, normalized)}
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            disabled={displayedAvailability.type !== "available" || saving}
            onClick={() => void claimUsername()}
            className="cp-button cp-button-primary w-full"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : `Claim @${normalized || "username"}`}
          </button>
          <Link href="/home" className="cp-button w-full text-primary">
            Skip for now
          </Link>
        </div>
      </div>
    </main>
  );
}

function StatusIcon({ availability }: { availability: Availability }) {
  if (availability.type === "checking") {
    return <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />;
  }
  if (availability.type === "available") {
    return <Check className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-success" />;
  }
  if (availability.type === "taken" || availability.type === "invalid") {
    return <X className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-error" />;
  }
  return null;
}

function statusText(availability: Availability, username: string) {
  if (!username) return "";
  if (availability.type === "invalid") return "2-32 characters: letters, numbers, underscore.";
  if (availability.type === "checking") return "Checking availability...";
  if (availability.type === "available") return `@${username} is available.`;
  if (availability.type === "taken") return `@${username} is taken.`;
  if (availability.type === "error") return "Could not check that username. Try again.";
  return "";
}

function statusClass(availability: Availability) {
  if (availability.type === "available") return "text-success";
  if (availability.type === "taken" || availability.type === "invalid" || availability.type === "error") {
    return "text-error";
  }
  if (availability.type === "checking") return "text-primary";
  return "text-text-muted";
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWRMutation from "swr/mutation";
import { Check, Copy, Loader2, Share2 } from "lucide-react";
import { CopyButton, RequireAuth, ScreenHeader } from "@/components/AppUI";
import { useCryptoPayAccount } from "@/lib/clientData";

export default function RequestPage() {
  return (
    <RequireAuth>
      <RequestScreen />
    </RequireAuth>
  );
}

function RequestScreen() {
  const router = useRouter();
  const { authenticated, getAccessToken } = useCryptoPayAccount();
  const [amount, setAmount] = useState("");
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isValid = useMemo(() => /^\d+(\.\d+)?$/.test(amount) && Number(amount) > 0, [amount]);

  const { trigger, isMutating, error } = useSWRMutation(
    authenticated && isValid ? ["createSession", amount] : null,
    async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error("create_failed");
      const json = (await res.json()) as { session: { short_code: string } };
      const url = `${window.location.origin}/s/${json.session.short_code}`;
      setLastLink(url);
      return json;
    },
  );

  async function copyLink() {
    if (!lastLink) return;
    await navigator.clipboard.writeText(lastLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function shareLink() {
    if (!lastLink) return;
    if (navigator.share) {
      await navigator.share({
        title: "Crypto Pay request",
        text: `Pay ${amount} USDC`,
        url: lastLink,
      });
      return;
    }
    await copyLink();
  }

  return (
    <main className="screen">
      <div className="mobile-shell safe-bottom animate-screen-in min-h-dvh px-6 py-6">
        <ScreenHeader title="Request" backHref="/home" />

        <section className="mt-8">
          <label className="text-[13px] font-medium text-text-secondary" htmlFor="request-amount">
            Amount
          </label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
              $
            </span>
            <input
              id="request-amount"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setLastLink(null);
              }}
              placeholder="0.00"
              inputMode="decimal"
              className="cp-input px-9 pr-16"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-text-muted">
              USDC
            </span>
          </div>

          <button
            type="button"
            disabled={!isValid || isMutating}
            onClick={() => void trigger()}
            className="cp-button cp-button-primary mt-6 w-full"
          >
            {isMutating ? <Loader2 className="h-5 w-5 animate-spin" /> : "Generate Link"}
          </button>

          {error ? (
            <p className="mt-3 rounded-xl bg-error-subtle p-3 text-sm text-error">
              Couldn&apos;t create link. Try again.
            </p>
          ) : null}
        </section>

        {lastLink ? (
          <section className="cp-card-elevated mt-8 p-5">
            <div className="flex items-center gap-2 text-success">
              <Check className="h-5 w-5" />
              <h2 className="text-base font-semibold">Payment link ready</h2>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background-secondary p-3">
              <p className="min-w-0 flex-1 truncate font-mono text-sm text-text-secondary">
                {lastLink}
              </p>
              <CopyButton text={lastLink} label="Copy link" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="cp-button cp-button-secondary w-full"
              >
                {copied ? <Check className="h-5 w-5 text-success" /> : <Copy className="h-5 w-5" />}
                Copy
              </button>
              <button
                type="button"
                onClick={() => void shareLink()}
                className="cp-button cp-button-primary w-full"
              >
                <Share2 className="h-5 w-5" />
                Share
              </button>
            </div>
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="cp-button cp-button-secondary mt-3 w-full"
            >
              Done
            </button>
          </section>
        ) : null}
      </div>
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";
import useSWRMutation from "swr/mutation";
import { usePrivy } from "@privy-io/react-auth";

export function RequestLink() {
  const { authenticated, getAccessToken } = usePrivy();
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

  const handleCopy = async () => {
    if (!lastLink) return;
    await navigator.clipboard.writeText(lastLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!authenticated) return null;

  return (
    <div className="rounded-2xl border border-white/[0.03] bg-[#151A2E] p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8B95A5]/10">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B95A5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </div>
        <p className="text-sm font-semibold">Request payment</p>
      </div>
      <p className="mt-1 text-xs text-[#8B95A5]">
        Create a link anyone can open to pay you
      </p>

      <div className="mt-4">
        <label className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#8B95A5] mb-1.5 block">
          Amount
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6578] text-sm">$</span>
            <input
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (lastLink) setLastLink(null);
              }}
              placeholder="0.00"
              inputMode="decimal"
              className="w-full rounded-xl border border-[#1E2538] bg-[#0B0F19] pl-7 pr-14 py-2.5 text-sm outline-none placeholder:text-[#5A6578] focus:ring-2 focus:ring-[#00D4AA]/50 focus:border-transparent transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#5A6578]">USDC</span>
          </div>
          <button
            type="button"
            disabled={!isValid || isMutating}
            onClick={() => trigger()}
            className="shrink-0 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#070b14] hover:scale-105 hover:brightness-110 transition-all disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            {isMutating ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#070b14]/30 border-t-[#070b14]" />
            ) : (
              "Generate"
            )}
          </button>
        </div>
      </div>

      {/* Generated link */}
      {lastLink && (
        <div className="mt-4 rounded-xl border border-[#00D4AA]/20 bg-[#00D4AA]/5 p-4 slide-up">
          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#00D4AA]">Payment link ready</p>
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#0B0F19] border border-[#1E2538] px-3 py-2">
            <p className="flex-1 truncate text-xs font-mono text-[#8B95A5]">{lastLink}</p>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-md p-1.5 hover:bg-white/[0.05] transition-colors"
              title="Copy link"
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B95A5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              )}
            </button>
          </div>
          <a
            href={lastLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-[#00D4AA] hover:underline"
          >
            Preview link
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>
      )}

      {error ? <p className="mt-3 text-xs text-[#FF6B6B]">Couldn&apos;t create link. Try again.</p> : null}
    </div>
  );
}
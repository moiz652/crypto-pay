"use client";

import { useMemo, useState } from "react";
import useSWRMutation from "swr/mutation";
import { usePrivy } from "@privy-io/react-auth";

export function RequestLink() {
  const { authenticated, getAccessToken } = usePrivy();
  const [amount, setAmount] = useState("");
  const [lastLink, setLastLink] = useState<string | null>(null);

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

  if (!authenticated) return null;

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold">Request payment</p>
      <p className="mt-1 text-xs text-white/60">
        Generate a link someone can open and pay.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (USDC)"
          inputMode="decimal"
          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-white/30"
        />
        <button
          type="button"
          disabled={!isValid || isMutating}
          onClick={() => trigger()}
          className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#070b14] disabled:opacity-50"
        >
          {isMutating ? "…" : "Link"}
        </button>
      </div>

      {lastLink ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs text-white/60">Payment link</p>
          <p className="mt-1 break-all text-xs font-mono">{lastLink}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(lastLink);
              }}
              className="rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
            >
              Copy
            </button>
            <a
              href={lastLink}
              className="rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
            >
              Open
            </a>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-300/90">Couldn’t create link.</p> : null}
    </div>
  );
}


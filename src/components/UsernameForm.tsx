"use client";

import { useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

export function UsernameForm({ onSaved }: { onSaved?: () => void }) {
  const { getAccessToken } = usePrivy();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "saving" }
    | { type: "saved" }
    | { type: "error"; message: string }
  >({ type: "idle" });

  const normalized = useMemo(() => value.trim().toLowerCase(), [value]);
  const isValid = /^[a-z0-9_]{2,32}$/i.test(normalized);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold">Choose your username</p>
      <p className="mt-1 text-xs text-white/60">
        People can pay you by <span className="font-mono">@username</span>.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex flex-1 items-center rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <span className="text-sm text-white/50">@</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="moiz"
            className="ml-1 w-full bg-transparent text-sm outline-none placeholder:text-white/30"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <button
          type="button"
          disabled={!isValid || status.type === "saving"}
          onClick={async () => {
            if (!isValid) return;
            setStatus({ type: "saving" });
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
                setStatus({ type: "error", message: "That username is taken." });
                return;
              }
              if (!res.ok) {
                setStatus({ type: "error", message: "Couldn’t save username." });
                return;
              }
              setStatus({ type: "saved" });
              onSaved?.();
            } catch {
              setStatus({ type: "error", message: "Network error." });
            }
          }}
          className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#070b14] disabled:opacity-50"
        >
          Save
        </button>
      </div>

      <div className="mt-2 text-xs">
        {!isValid ? (
          <p className="text-white/50">2–32 chars: letters, numbers, underscore.</p>
        ) : status.type === "saving" ? (
          <p className="text-white/60">Saving…</p>
        ) : status.type === "saved" ? (
          <p className="text-emerald-300/90">Saved.</p>
        ) : status.type === "error" ? (
          <p className="text-red-300/90">{status.message}</p>
        ) : null}
      </div>
    </div>
  );
}


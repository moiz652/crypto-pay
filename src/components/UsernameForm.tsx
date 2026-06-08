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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6578] text-sm font-mono">@</span>
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (status.type === "error" || status.type === "saved") {
                setStatus({ type: "idle" });
              }
            }}
            placeholder="choose a username"
            className="w-full rounded-xl border border-[#1E2538] bg-[#0B0F19] pl-7 pr-3 py-2.5 text-sm outline-none placeholder:text-[#5A6578] focus:ring-2 focus:ring-[#00D4AA]/50 focus:border-transparent transition-all"
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
                setStatus({ type: "error", message: "Couldn&apos;t save username." });
                return;
              }
              setStatus({ type: "saved" });
              onSaved?.();
            } catch {
              setStatus({ type: "error", message: "Network error." });
            }
          }}
          className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#070b14] hover:scale-105 hover:brightness-110 transition-all disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
        >
          {status.type === "saving" ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#070b14]/30 border-t-[#070b14]" />
          ) : (
            "Save"
          )}
        </button>
      </div>

      <div className="min-h-[18px]">
        {!isValid && value.length > 0 ? (
          <p className="text-xs text-[#5A6578]">2–32 characters: letters, numbers, underscore</p>
        ) : status.type === "saved" ? (
          <p className="text-xs text-[#00D4AA] flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Username saved
          </p>
        ) : status.type === "error" ? (
          <p className="text-xs text-[#FF6B6B]">{status.message}</p>
        ) : null}
      </div>
    </div>
  );
}
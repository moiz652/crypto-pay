"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallPrompt() {
  const [bipEvent, setBipEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [hidden, setHidden] = useState(false);

  const canInstall = useMemo(() => Boolean(bipEvent) && !hidden, [bipEvent, hidden]);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setBipEvent(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setBipEvent(null);
      setHidden(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (!canInstall) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-[#1E2538] bg-[#151A2E]/95 p-4 text-[#F0F2F5] shadow-xl backdrop-blur slide-up">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00D4AA]/10 border border-[#00D4AA]/20">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold">Install Crypto Pay</p>
            <p className="mt-0.5 text-xs text-[#8B95A5]">
              Add to your home screen for the fastest experience.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-[#5A6578] hover:text-[#F0F2F5] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <button
        type="button"
        onClick={async () => {
          if (!bipEvent) return;
          await bipEvent.prompt();
          await bipEvent.userChoice.catch(() => undefined);
          setBipEvent(null);
        }}
        className="mt-3 w-full rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-[#070b14] hover:scale-[1.02] hover:brightness-110 transition-all"
      >
        Install
      </button>
    </div>
  );
}
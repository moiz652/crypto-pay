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
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-white/10 bg-[#0b1220]/95 p-4 text-white shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Install Crypto Pay</p>
          <p className="mt-1 text-xs text-white/70">
            Add it to your home screen for the fastest checkout next time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="rounded-md px-2 py-1 text-xs text-white/70 hover:text-white"
        >
          Not now
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
        className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#0b1220] hover:bg-white/90"
      >
        Install
      </button>
    </div>
  );
}


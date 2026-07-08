"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { ScreenHeader } from "@/components/AppUI";

type FirstSendAcknowledgmentProps = {
  submitting: boolean;
  error: string;
  onAcknowledge: () => Promise<void>;
};

export function FirstSendAcknowledgment({
  submitting,
  error,
  onAcknowledge,
}: FirstSendAcknowledgmentProps) {
  return (
    <main className="screen">
      <div className="mobile-shell safe-bottom animate-screen-in min-h-dvh px-6 py-6">
        <ScreenHeader title="Send" backHref="/home" closeHref="/home" />

        <section className="mt-12 flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-error-subtle text-error">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-[28px] font-bold text-text-primary">
            Crypto sends are final
          </h1>
          <p className="mt-3 max-w-sm text-base leading-6 text-text-secondary">
            Once you send USDC, the transaction cannot be reversed. Double-check the
            recipient and amount before confirming.
          </p>
        </section>

        <div className="mt-10 space-y-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onAcknowledge()}
            className="cp-button cp-button-primary w-full"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "I understand, continue"
            )}
          </button>
          {error ? (
            <p className="rounded-xl bg-error-subtle p-3 text-center text-sm text-error">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

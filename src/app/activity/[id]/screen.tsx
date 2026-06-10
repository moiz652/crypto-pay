"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  ActivityIcon,
  ActivityMeta,
  DetailRow,
  RequireAuth,
  ScreenHeader,
} from "@/components/AppUI";
import {
  findActivityItem,
  formatFullDate,
  humanStatus,
  useActivity,
} from "@/lib/clientData";
import { publicClient } from "@/lib/viem";

type TxConfirmation = "pending" | "confirmed" | "failed" | null;

export function ActivityDetailClient({ id }: { id: string }) {
  return (
    <RequireAuth>
      <ActivityDetail id={id} />
    </RequireAuth>
  );
}

function ActivityDetail({ id }: { id: string }) {
  const { data, isLoading } = useActivity();
  const item = findActivityItem(data, id);
  const [confirmation, setConfirmation] = useState<TxConfirmation>(null);

  useEffect(() => {
    if (!item?.txHash) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const receipt = await publicClient.getTransactionReceipt({
          hash: item.txHash as `0x${string}`,
        });
        if (cancelled) return;
        setConfirmation(receipt.status === "success" ? "confirmed" : "failed");
      } catch {
        if (!cancelled) setConfirmation("pending");
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [item?.txHash]);

  return (
    <main className="screen">
      <div className="mobile-shell safe-bottom animate-screen-in min-h-dvh px-6 py-6">
        <ScreenHeader title="Activity" backHref="/activity" />

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !item ? (
          <section className="mt-10 text-center">
            <p className="text-base font-semibold text-text-primary">Transaction not found</p>
            <p className="mt-2 text-sm text-text-secondary">Refresh activity and try again.</p>
          </section>
        ) : (
          <section className="mt-8">
            <div className="flex flex-col items-center text-center">
              <ActivityIcon type={item.type} status={item.status} />
              <p className="mt-5 text-[40px] font-bold leading-none text-text-primary">
                {item.amount} {item.token}
              </p>
              <p className="mt-3 text-lg font-semibold text-text-primary">{item.title}</p>
              <p className="mt-1 text-sm text-text-secondary">{formatFullDate(item.createdAt)}</p>
              {confirmation && item.txHash ? (
                <span
                  className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    confirmation === "confirmed"
                      ? "bg-success-subtle text-success"
                      : confirmation === "failed"
                        ? "bg-error-subtle text-error"
                        : "bg-warning-subtle text-warning"
                  }`}
                >
                  {confirmation === "confirmed"
                    ? "Confirmed on Base"
                    : confirmation === "failed"
                      ? "Failed"
                      : "Pending"}
                </span>
              ) : null}
            </div>

            <div className="cp-card mt-8 space-y-3 p-5">
              <DetailRow label="Status" value={humanStatus(item.status) || "Complete"} />
              <DetailRow label="Type" value={humanStatus(item.type)} />
              <DetailRow label="Network" value="Base" />
              <ActivityMeta
                txHash={item.txHash}
                createdAt={item.createdAt}
                shortCode={item.shortCode}
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

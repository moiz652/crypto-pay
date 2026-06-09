"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ActivityList, BottomTabs, RequireAuth, cn } from "@/components/AppUI";
import { normalizeActivity, useActivity } from "@/lib/clientData";

type Filter = "all" | "sent" | "received" | "request";

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "sent", label: "Sent" },
  { id: "received", label: "Received" },
  { id: "request", label: "Requests" },
];

export default function ActivityPage() {
  return (
    <RequireAuth>
      <ActivityScreen />
    </RequireAuth>
  );
}

function ActivityScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const startY = useRef<number | null>(null);
  const { data, isLoading, mutate, isValidating } = useActivity();
  const items = normalizeActivity(data);
  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.type === filter)),
    [filter, items],
  );

  return (
    <main
      className="screen-muted"
      onTouchStart={(event) => {
        startY.current = event.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(event) => {
        if (startY.current === null) return;
        const endY = event.changedTouches[0]?.clientY ?? startY.current;
        if (endY - startY.current > 80) void mutate();
        startY.current = null;
      }}
    >
      <div className="mobile-shell with-tabbar animate-screen-in min-h-dvh px-6 py-6">
        <header className="flex items-center justify-between">
          <h1 className="text-[28px] font-bold leading-tight text-text-primary">Activity</h1>
          {isValidating ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : null}
        </header>

        <div className="mt-6 flex rounded-full bg-white p-1 shadow-sm dark:bg-[#151B2B]">
          {filters.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setFilter(entry.id)}
              className={cn(
                "min-h-10 flex-1 rounded-full px-3 text-sm font-medium transition",
                filter === entry.id
                  ? "bg-text-primary text-white dark:bg-primary"
                  : "text-text-secondary dark:text-slate-300",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <section className="mt-5">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <ActivityList items={filtered} emptyText="No transactions yet." />
          )}
        </section>
      </div>
      <BottomTabs />
    </main>
  );
}

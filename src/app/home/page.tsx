"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Drawer } from "vaul";
import { ClipboardList, Plus, Send } from "lucide-react";
import {
  ActivityList,
  Avatar,
  BottomTabs,
  RequireAuth,
  cn,
} from "@/components/AppUI";
import {
  normalizeActivity,
  useActivity,
  useCryptoPayAccount,
  useUsdcBalance,
} from "@/lib/clientData";

export default function HomePage() {
  return (
    <RequireAuth>
      <HomeScreen />
    </RequireAuth>
  );
}

function HomeScreen() {
  const router = useRouter();
  const { username, email, phone, address } = useCryptoPayAccount();
  const { display } = useUsdcBalance(address);
  const { data: activity } = useActivity();
  const items = normalizeActivity(activity);
  const identity = username ? `@${username}` : email ?? phone ?? "Profile";

  return (
    <main className="screen-muted">
      <div className="mobile-shell with-tabbar animate-screen-in min-h-dvh px-6 py-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-text-primary">Crypto Pay</h1>
          <Link href="/settings" aria-label="Open settings">
            <Avatar seed={identity} size="sm" />
          </Link>
        </header>

        <section className="cp-card-elevated mt-6 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-text-secondary">Your balance</p>
            <span className="rounded-full bg-primary-subtle px-2.5 py-1 text-xs font-medium text-primary">
              Base
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <p className="text-[40px] font-bold leading-none tracking-normal text-text-primary">
              ${display}
            </p>
            <span className="mb-1 rounded-full bg-primary-subtle px-2.5 py-1 text-sm font-semibold text-primary">
              USDC
            </span>
          </div>
          <p className="mt-3 truncate text-sm text-text-secondary">{identity}</p>
        </section>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link href="/send" className="cp-button cp-button-primary w-full">
            <Send className="h-5 w-5" />
            Send
          </Link>
          <Link href="/request" className="cp-button cp-button-secondary w-full">
            <ClipboardList className="h-5 w-5" />
            Request
          </Link>
        </div>

        <section className="cp-card mt-5 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">Recent activity</h2>
            <Link href="/activity" className="text-sm font-semibold text-primary">
              View all
            </Link>
          </div>
          <ActivityList items={items} limit={3} />
        </section>
      </div>

      <Drawer.Root>
        <Drawer.Trigger asChild>
          <button
            type="button"
            className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_4px_12px_rgba(0,102,255,0.3)]"
            aria-label="New payment action"
          >
            <Plus className="h-6 w-6" />
          </button>
        </Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm" />
          <Drawer.Content className="animate-sheet-in fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] bg-white px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
            <div className="mx-auto h-1 w-10 rounded-full bg-border" />
            <Drawer.Title className="mt-6 text-center text-xl font-semibold text-text-primary">
              New payment
            </Drawer.Title>
            <div className="mx-auto mt-5 max-w-[432px] space-y-3">
              <button
                type="button"
                onClick={() => router.push("/send")}
                className={cn("cp-button cp-button-primary w-full")}
              >
                <Send className="h-5 w-5" />
                Send
              </button>
              <button
                type="button"
                onClick={() => router.push("/request")}
                className="cp-button cp-button-secondary w-full"
              >
                <ClipboardList className="h-5 w-5" />
                Request
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <BottomTabs />
    </main>
  );
}

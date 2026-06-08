"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ClipboardList,
  Copy,
  Home,
  Loader2,
  Settings,
  X,
} from "lucide-react";
import {
  ActivityItem,
  formatDate,
  humanStatus,
  truncateAddress,
  useCryptoPayAccount,
} from "@/lib/clientData";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function LoadingScreen({ muted = false }: { muted?: boolean }) {
  return (
    <main className={muted ? "screen-muted" : "screen"}>
      <div className="mobile-shell flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading" />
      </div>
    </main>
  );
}

export function MissingPrivyConfig() {
  return (
    <main className="screen">
      <div className="mobile-shell flex min-h-dvh items-center justify-center">
        <div className="cp-card p-5">
          <p className="text-base font-semibold text-text-primary">Missing Privy configuration</p>
          <p className="mt-2 text-sm text-text-secondary">
            Set <span className="font-mono">NEXT_PUBLIC_PRIVY_APP_ID</span> in{" "}
            <span className="font-mono">.env.local</span>, then restart the dev server.
          </p>
        </div>
      </div>
    </main>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, authenticated } = useCryptoPayAccount();

  useEffect(() => {
    if (ready && !authenticated) router.replace("/welcome");
  }, [authenticated, ready, router]);

  if (!ready || !authenticated) return <LoadingScreen />;
  return <>{children}</>;
}

export function ScreenHeader({
  title,
  backHref,
  closeHref,
}: {
  title: string;
  backHref?: string;
  closeHref?: string;
}) {
  const router = useRouter();

  return (
    <header className="grid h-12 grid-cols-[40px_1fr_40px] items-center">
      {backHref ? (
        <Link href={backHref} className="icon-button" aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      ) : (
        <button type="button" className="icon-button" onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <h1 className="text-center text-[28px] font-bold leading-tight text-text-primary">{title}</h1>
      {closeHref ? (
        <Link href={closeHref} className="icon-button" aria-label="Close">
          <X className="h-5 w-5" />
        </Link>
      ) : (
        <div />
      )}
    </header>
  );
}

export function ProgressDots({ active, total = 4 }: { active: number; total?: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`Step ${active} of ${total}`}>
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "h-2 w-2 rounded-full",
            index < active ? "bg-primary" : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

export function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn("icon-button", className)}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

export function Avatar({
  seed,
  size = "md",
}: {
  seed?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const label = (seed?.trim()?.replace(/^@/, "") || "U").slice(0, 1).toUpperCase();
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary-subtle font-semibold text-primary",
        size === "sm" && "h-8 w-8 text-sm",
        size === "md" && "h-10 w-10 text-base",
        size === "lg" && "h-12 w-12 text-lg",
      )}
      aria-hidden="true"
    >
      {label}
    </div>
  );
}

export function BottomTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/home", label: "Home", icon: Home },
    { href: "/activity", label: "Activity", icon: ClipboardList },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white">
      <div className="mx-auto grid h-16 max-w-[480px] grid-cols-3 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]",
                active ? "font-medium text-primary" : "text-text-muted",
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={active ? 2 : 1.5} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function ActivityList({
  items,
  limit,
  emptyText = "No transactions yet.",
}: {
  items: ActivityItem[];
  limit?: number;
  emptyText?: string;
}) {
  const visible = typeof limit === "number" ? items.slice(0, limit) : items;

  if (!visible.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background-secondary text-text-muted">
          <ClipboardList className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-medium text-text-secondary">{emptyText}</p>
        <p className="mt-1 text-xs text-text-muted">Send or request your first payment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visible.map((item) => (
        <Link key={item.id} href={item.href} className="cp-card flex items-center gap-3 p-3 transition hover:border-slate-300 hover:shadow-sm">
          <ActivityIcon type={item.type} status={item.status} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text-primary">{item.title}</p>
            <p className="truncate text-xs text-text-muted">{item.subtitle}</p>
          </div>
          <div className="text-right">
            <p
              className={cn(
                "text-sm font-semibold",
                item.type === "sent" && "text-error",
                item.type === "received" && "text-success",
                item.type === "request" && "text-text-primary",
              )}
            >
              {item.amount} {item.token}
            </p>
            {item.status ? (
              <span className="text-xs text-text-muted">{humanStatus(item.status)}</span>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function ActivityIcon({
  type,
  status,
}: {
  type: ActivityItem["type"];
  status?: string;
}) {
  const classes =
    type === "sent"
      ? "bg-error-subtle text-error"
      : type === "received"
        ? "bg-success-subtle text-success"
        : status === "paid"
          ? "bg-success-subtle text-success"
          : "bg-primary-subtle text-primary";

  return (
    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", classes)}>
      {type === "sent" ? (
        <ArrowUp className="h-5 w-5" />
      ) : type === "received" ? (
        <ArrowDown className="h-5 w-5" />
      ) : (
        <ClipboardList className="h-5 w-5" />
      )}
    </div>
  );
}

export function AddressRow({ address }: { address?: string | null }) {
  if (!address) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-background-secondary p-3">
      <p className="min-w-0 flex-1 truncate font-mono text-sm text-text-secondary">
        {truncateAddress(address)}
      </p>
      <CopyButton text={address} label="Copy wallet address" />
    </div>
  );
}

export function ToastStack({
  toasts,
}: {
  toasts: Array<{ id: number; message: string; type: "success" | "error" }>;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex flex-col items-center gap-2" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "toast-enter pointer-events-auto mx-4 max-w-[400px] rounded-xl border px-4 py-3 text-sm font-medium shadow-lg",
            toast.type === "success"
              ? "border-emerald-200 bg-success-subtle text-success"
              : "border-red-200 bg-error-subtle text-error",
          )}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export function ActivityMeta({
  txHash,
  createdAt,
  shortCode,
}: {
  txHash?: string | null;
  createdAt?: string;
  shortCode?: string;
}) {
  return (
    <div className="space-y-3">
      {createdAt ? (
        <DetailRow label="Date" value={formatDate(createdAt)} />
      ) : null}
      {shortCode ? <DetailRow label="Request code" value={shortCode} /> : null}
      {txHash ? (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-sm text-text-secondary">Transaction</span>
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-primary"
          >
            View on BaseScan
          </a>
        </div>
      ) : null}
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-right text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}

export function useProfileSummary() {
  const { username, email, phone } = useCryptoPayAccount();
  const identity = email ?? phone ?? "Connected";
  return useMemo(
    () => ({
      avatarSeed: username ?? identity,
      label: username ? `@${username}` : identity,
      identity,
    }),
    [identity, username],
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import {
  AddressRow,
  Avatar,
  BottomTabs,
  RequireAuth,
  cn,
} from "@/components/AppUI";
import { useCryptoPayAccount } from "@/lib/clientData";
import {
  ThemeChoice,
  applyThemeChoice,
  persistThemeChoice,
  readThemeChoice,
  themeOptions,
} from "@/lib/theme";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsScreen />
    </RequireAuth>
  );
}

function SettingsScreen() {
  const router = useRouter();
  const { username, email, phone, address, logout, profileLoading } =
    useCryptoPayAccount();
  const [theme, setTheme] = useState<ThemeChoice>(() => readThemeChoice());

  // Stable avatar seed: email/phone are available immediately from Privy,
  // so the avatar letter never changes as the profile loads.
  const avatarSeed = email ?? phone ?? username ?? "user";

  // Only show @username once the profile has loaded.
  // While loading: show a skeleton (no email flicker).
  // After load: show @username, or fall back to email/phone.
  const label = username
    ? `@${username}`
    : profileLoading
      ? null
      : email ?? phone ?? "Connected";

  useEffect(() => {
    applyThemeChoice(theme);
  }, [theme]);

  function updateTheme(next: ThemeChoice) {
    setTheme(next);
    persistThemeChoice(next);
  }

  async function signOut() {
    await logout();
    router.replace("/welcome");
  }

  return (
    <main className="screen-muted dark:bg-[#0B0F19] dark:text-white">
      <div className="mobile-shell with-tabbar animate-screen-in min-h-dvh px-6 py-6">
        <h1 className="text-[28px] font-bold leading-tight text-text-primary dark:text-white">
          Settings
        </h1>

        <section className="cp-card mt-6 p-5 dark:border-slate-800 dark:bg-[#151B2B]">
          <div className="flex items-center gap-4">
            <Avatar seed={avatarSeed} size="lg" />
            <div className="min-w-0">
              {/* Username row: skeleton while loading, then @username */}
              {label !== null ? (
                <p className="truncate text-base font-semibold text-text-primary dark:text-white">
                  {label}
                </p>
              ) : (
                <div className="h-5 w-28 animate-pulse rounded-md bg-border" />
              )}
              {/* Email/phone always available immediately — no flicker */}
              <p className="mt-0.5 truncate text-sm text-text-secondary dark:text-slate-300">
                {email ?? phone ?? ""}
              </p>
            </div>
          </div>
        </section>

        <section className="cp-card mt-4 p-5 dark:border-slate-800 dark:bg-[#151B2B]">
          <h2 className="text-base font-semibold text-text-primary dark:text-white">
            Wallet address
          </h2>
          <p className="mt-1 text-sm text-text-secondary dark:text-slate-300">
            Use this only when someone needs your wallet address.
          </p>
          <div className="mt-4">
            {/* Show skeleton while wallet initialises — prevents blank flash */}
            {address ? (
              <AddressRow address={address} />
            ) : (
              <div className="h-10 w-full animate-pulse rounded-xl bg-background-secondary" />
            )}
          </div>
        </section>

        <section className="cp-card mt-4 p-5 dark:border-slate-800 dark:bg-[#151B2B]">
          <h2 className="text-base font-semibold text-text-primary dark:text-white">
            Theme
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-background-secondary p-1 dark:bg-[#0B0F19]">
            {themeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => updateTheme(option.id)}
                className={cn(
                  "min-h-10 rounded-xl text-sm font-medium transition",
                  theme === option.id
                    ? "bg-white text-primary shadow-sm dark:bg-primary dark:text-white"
                    : "text-text-secondary dark:text-slate-300",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={() => void signOut()}
          className="cp-button mt-6 w-full bg-error text-white"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
      <BottomTabs />
    </main>
  );
}
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
  const { username, email, phone, address, logout } = useCryptoPayAccount();
  const [theme, setTheme] = useState<ThemeChoice>(() => readThemeChoice());
  const label = username ? `@${username}` : email ?? phone ?? "Connected";

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
        <h1 className="text-[28px] font-bold leading-tight text-text-primary dark:text-white">Settings</h1>

        <section className="cp-card mt-6 p-5 dark:border-slate-800 dark:bg-[#151B2B]">
          <div className="flex items-center gap-4">
            <Avatar seed={label} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-text-primary dark:text-white">{label}</p>
              <p className="truncate text-sm text-text-secondary dark:text-slate-300">{email ?? phone ?? "Profile"}</p>
            </div>
          </div>
        </section>

        <section className="cp-card mt-4 p-5 dark:border-slate-800 dark:bg-[#151B2B]">
          <h2 className="text-base font-semibold text-text-primary dark:text-white">Wallet address</h2>
          <p className="mt-1 text-sm text-text-secondary dark:text-slate-300">Use this only when someone needs your wallet address.</p>
          <div className="mt-4">
            <AddressRow address={address} />
          </div>
        </section>

        <section className="cp-card mt-4 p-5 dark:border-slate-800 dark:bg-[#151B2B]">
          <h2 className="text-base font-semibold text-text-primary dark:text-white">Theme</h2>
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

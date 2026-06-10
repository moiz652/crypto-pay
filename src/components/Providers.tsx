"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { useEffect } from "react";
import { base } from "viem/chains";
import { SessionTimeout } from "@/components/SessionTimeout";
import { THEME_STORAGE_KEY, applyThemeChoice, readThemeChoice } from "@/lib/theme";

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const themedChildren = <ThemeController>{children}</ThemeController>;

  if (!appId) return themedChildren;

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google", "apple"],
        appearance: {
          theme: "light",
          accentColor: "#0066FF",
          loginMessage: "Send money with just a username.",
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        defaultChain: base,
        supportedChains: [base],
      }}
    >
      <SessionTimeout />
      {themedChildren}
    </PrivyProvider>
  );
}

function ThemeController({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const applySavedTheme = () => applyThemeChoice(readThemeChoice());
    applySavedTheme();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applySavedTheme);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) applySavedTheme();
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      media.removeEventListener("change", applySavedTheme);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return <>{children}</>;
}


"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen, MissingPrivyConfig } from "@/components/AppUI";
import { useCryptoPayAccount } from "@/lib/clientData";

export default function RootPage() {
  const router = useRouter();
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const { ready, authenticated, username, profileLoading } = useCryptoPayAccount();

  useEffect(() => {
    if (!privyAppId || !ready || profileLoading) return;
    if (!authenticated) {
      router.replace("/welcome");
      return;
    }
    router.replace(username ? "/home" : "/onboarding/wallet");
  }, [authenticated, privyAppId, profileLoading, ready, router, username]);

  if (!privyAppId) return <MissingPrivyConfig />;
  return <LoadingScreen />;
}

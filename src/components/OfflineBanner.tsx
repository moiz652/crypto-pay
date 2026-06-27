"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const off = () => setOffline(true);
    const on  = () => setOffline(false);
    window.addEventListener("offline", off);
    window.addEventListener("online",  on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online",  on);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-2 bg-error px-4 py-2 text-sm font-semibold text-white">
      <WifiOff className="h-4 w-4" />
      You're offline — reconnect to send or receive payments
    </div>
  );
}
"use client";
import { useEffect, useState, useRef } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [mounted, setMounted] = useState(false);
  const probing = useRef(false);

  useEffect(() => {
    setMounted(true);

    async function probe() {
      if (probing.current) return;
      probing.current = true;
      try {
        await fetch("/manifest.webmanifest", { method: "HEAD", cache: "no-store" });
        setOffline(false);
      } catch {
        setOffline(true);
      } finally {
        probing.current = false;
      }
    }

    probe();
    window.addEventListener("online", probe);
    window.addEventListener("offline", probe);
    const interval = setInterval(probe, 15000);

    return () => {
      window.removeEventListener("online", probe);
      window.removeEventListener("offline", probe);
      clearInterval(interval);
    };
  }, []);

  if (!mounted || !offline) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-2 bg-error px-4 py-2 text-sm font-semibold text-white">
      <WifiOff className="h-4 w-4" />
      You're offline — reconnect to send or receive payments
    </div>
  );
}
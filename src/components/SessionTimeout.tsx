"use client";

import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";

const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const LAST_ACTIVITY_KEY = "cryptopay_last_activity";
const CHECK_INTERVAL_MS = 60_000;

function getLastActivity(): number {
  const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
  return raw ? parseInt(raw, 10) : Date.now();
}

function updateLastActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function SessionTimeout() {
  const { authenticated, logout } = usePrivy();

  useEffect(() => {
    if (!authenticated) return;

    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    const handleActivity = () => updateLastActivity();

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    updateLastActivity();

    const interval = window.setInterval(() => {
      const lastActivity = getLastActivity();
      if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
        console.log("[SessionTimeout] 24hr idle timeout reached. Logging out.");
        void logout();
        localStorage.removeItem(LAST_ACTIVITY_KEY);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      window.clearInterval(interval);
    };
  }, [authenticated, logout]);

  return null;
}

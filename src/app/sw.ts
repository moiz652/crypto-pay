/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Explicit navigation handler: intercepts all navigate-mode requests with
// NetworkFirst (3s timeout → serve from cache). This replaces the catch-all
// NetworkOnly rule in defaultCache that would block offline navigation.
const navigationHandler = new NetworkFirst({
  cacheName: "navigation-cache",
  networkTimeoutSeconds: 3,
});

const serwist = new Serwist({
  precacheEntries: [
    ...(self.__SW_MANIFEST ?? []),
    // Belt-and-suspenders: always precache the offline page even if
    // __SW_MANIFEST injection fails (e.g. Vercel build cache issues).
    { url: "/~offline", revision: "v1" },
  ],
  precacheOptions: { cleanupOutdatedCaches: true },
  skipWaiting: true,
  clientsClaim: true,
  // IMPORTANT: navigationPreload: true causes the SW handler to return the
  // preloaded response via getPreloadResponse() without calling cachePut().
  // Navigation responses are never cached → offline = blank screen.
  // Setting false forces the handler to fetch-and-cache normally.
  navigationPreload: false,
  disableDevLogs: true,
  runtimeCaching: [
    {
      matcher: ({ request }: { request: Request }) =>
        request.mode === "navigate",
      handler: navigationHandler,
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.mode === "navigate";
        },
      },
    ],
  },
});

serwist.addEventListeners();
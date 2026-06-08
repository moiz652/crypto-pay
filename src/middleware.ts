import { NextResponse } from "next/server";

const csp = [
  "default-src 'self'",
  // Privy loads scripts from auth.privy.io and embeds iframes from privy.io subdomains.
  // 'unsafe-eval' is required by some Privy internals (e.g. wallet creation workers).
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.privy.io https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  // connect-src must allow:
  //   - Privy API + auth (all subdomains: auth, api, telemetry, recovery, etc.)
  //   - Supabase REST + realtime websocket
  //   - Any Base RPC (mainnet https://mainnet.base.org, Sepolia public nodes, Alchemy, etc.)
  //   - Upstash Redis (rate limiting)
  //   - WalletConnect (Privy uses it internally for external wallet support)
  //   - publicnode.com (free public RPC used for testnet)
  "connect-src 'self' https://*.privy.io wss://*.privy.io https://*.supabase.co wss://*.supabase.co https://*.base.org wss://*.base.org https://*.alchemy.com wss://*.alchemy.com https://*.publicnode.com https://*.upstash.io https://*.walletconnect.com wss://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.org",
  // Privy login modal and wallet confirmation screens load in iframes from privy.io
  "frame-src 'self' https://*.privy.io https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function middleware() {
  const response = NextResponse.next();

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

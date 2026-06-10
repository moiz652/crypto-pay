import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

export type RateLimitPreset =
  | "profile_sync"
  | "sessions_create"
  | "users_resolve"
  | "sessions_get"
  | "activity"
  | "default";

const LIMITS: Record<RateLimitPreset, { requests: number; window: `${number} s` | `${number} m` }> = {
  profile_sync: { requests: 5, window: "1 m" },
  sessions_create: { requests: 10, window: "1 m" },
  users_resolve: { requests: 20, window: "1 m" },
  sessions_get: { requests: 30, window: "1 m" },
  activity: { requests: 20, window: "1 m" },
  default: { requests: 30, window: "1 m" },
};

const limiters = new Map<RateLimitPreset, Ratelimit>();
let redisAvailable: boolean | null = null;

function getLimiter(preset: RateLimitPreset): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisAvailable = false;
    return null;
  }

  let limiter = limiters.get(preset);
  if (!limiter) {
    const { requests, window } = LIMITS[preset];
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix: `cryptopay:${preset}`,
    });
    limiters.set(preset, limiter);
  }
  redisAvailable = true;
  return limiter;
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

export async function enforceRateLimit(
  req: Request,
  preset: RateLimitPreset,
): Promise<NextResponse | null> {
  const limiter = getLimiter(preset);
  if (!limiter) {
    return NextResponse.json({ error: "rate_limiter_unavailable" }, { status: 429 });
  }

  const ip = getClientIp(req);
  let result: Awaited<ReturnType<Ratelimit["limit"]>>;
  try {
    result = await limiter.limit(ip);
    redisAvailable = true;
  } catch {
    redisAvailable = false;
    return NextResponse.json({ error: "rate_limiter_unavailable" }, { status: 429 });
  }

  const { success, limit, remaining, reset } = result;

  if (!success) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
          "Retry-After": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
        },
      },
    );
  }

  return null;
}

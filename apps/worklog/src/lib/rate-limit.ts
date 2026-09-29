import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

type Limiters = { burst: Ratelimit; daily: Ratelimit };

let limiters: Limiters | null | undefined;

function getLimiters(): Limiters | null {
  if (limiters !== undefined) return limiters;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[worklog] Upstash is not configured; generation is not rate limited.");
    }
    limiters = null;
    return limiters;
  }
  const redis = new Redis({ url, token });
  const daily = Number(process.env.GENERATION_DAILY_LIMIT) || 50;
  limiters = {
    burst: new Ratelimit({
      redis,
      prefix: "worklog:gen:burst",
      limiter: Ratelimit.slidingWindow(6, "1 m"),
    }),
    daily: new Ratelimit({
      redis,
      prefix: "worklog:gen:day",
      limiter: Ratelimit.fixedWindow(daily, "1 d"),
    }),
  };
  return limiters;
}

/** Caps LLM spend per user. Always allows when Upstash isn't configured. */
export async function checkGenerationLimit(userId: string): Promise<RateLimitResult> {
  const l = getLimiters();
  if (!l) return { ok: true };
  for (const limiter of [l.burst, l.daily]) {
    const res = await limiter.limit(userId);
    if (!res.success) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
      };
    }
  }
  return { ok: true };
}

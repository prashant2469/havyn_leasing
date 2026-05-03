import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type SlidingWindowInput = {
  namespace: string;
  identifier: string;
  limit?: number;
  window?: `${number} s` | `${number} m` | `${number} h`;
};

type SlidingWindowResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  degraded: boolean;
};

const limiters = new Map<string, Ratelimit>();

function getRedisClient() {
  if (!process.env.KV_REST_API_URL?.trim() || !process.env.KV_REST_API_TOKEN?.trim()) {
    return null;
  }
  return Redis.fromEnv();
}

function getLimiter(namespace: string, limit: number, window: `${number} s` | `${number} m` | `${number} h`) {
  const key = `${namespace}:${limit}:${window}`;
  const cached = limiters.get(key);
  if (cached) return cached;

  const redis = getRedisClient();
  if (!redis) return null;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: true,
    prefix: `havyn:${namespace}`,
  });
  limiters.set(key, limiter);
  return limiter;
}

export async function checkSlidingWindow(input: SlidingWindowInput): Promise<SlidingWindowResult> {
  const limit = input.limit ?? 5;
  const window = input.window ?? "1 m";
  const limiter = getLimiter(input.namespace, limit, window);

  // Fail-open to keep auth/jobs available if Upstash is unavailable.
  if (!limiter) {
    return { success: true, limit, remaining: limit, reset: Date.now() + 60_000, degraded: true };
  }

  try {
    const result = await limiter.limit(input.identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      degraded: false,
    };
  } catch (error) {
    console.warn("[rate-limit] degraded mode", error);
    return { success: true, limit, remaining: limit, reset: Date.now() + 60_000, degraded: true };
  }
}

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export type RateLimiter = {
  consume(
    key: string,
    options: {
      limit: number;
      windowMs: number;
      now?: number;
    },
  ): RateLimitResult;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  consume(
    key: string,
    {
      limit,
      windowMs,
      now = Date.now(),
    }: {
      limit: number;
      windowMs: number;
      now?: number;
    },
  ): RateLimitResult {
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return {
        allowed: true,
        retryAfterSeconds: 0,
      };
    }

    if (bucket.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    }

    bucket.count += 1;
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }
}

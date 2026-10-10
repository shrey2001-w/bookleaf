import { ApiError } from "./api";

/** Tiny in-memory sliding-window limiter (per server instance). Protects AI spend from accidental or abusive loops. */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs = 60_000) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    throw new ApiError(429, "rate_limited", "You're asking too quickly. Please wait a minute and try again.");
  }
  recent.push(now);
  hits.set(key, recent);
}

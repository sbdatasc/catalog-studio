import { ServiceError } from "../lib/errors";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, RateLimitEntry>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function checkRateLimit(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);

  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_ATTEMPTS) {
      throw new ServiceError(
        "AUTH_RATE_LIMITED",
        "Too many attempts. Try again in 15 minutes.",
      );
    }
    entry.count++;
  } else {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  }
}

export function clearRateLimit(key: string): void {
  attempts.delete(key);
}

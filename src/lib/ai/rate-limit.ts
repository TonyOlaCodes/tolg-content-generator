/** Simple in-memory rate limiter for serverless-ish single instance / local. */
const hits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, rpm = Number(process.env.AI_RATE_LIMIT_RPM || 20)): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const row = hits.get(key);
  if (!row || now > row.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= rpm) return false;
  row.count += 1;
  return true;
}

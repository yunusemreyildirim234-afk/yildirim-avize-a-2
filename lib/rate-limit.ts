// Hafif, bellek içi IP bazlı rate limit (sunucusuz ortamda her örnek için ayrı sayılır; tam koruma için Redis/Upstash gerekir)
const buckets = new Map<string, { count: number; resetAt: number }>();

export function requestIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Sınır aşıldıysa `{ limited: true, retryAfter }` döner; aksi halde sayacı artırır. */
export function rateLimit(req: Request, name: string, max: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  const key = `${name}:${requestIp(req)}`;
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false as const, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > max) return { limited: true as const, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  return { limited: false as const, retryAfter: 0 };
}

export function tooMany(retryAfter: number, message = "Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin.") {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
  });
}

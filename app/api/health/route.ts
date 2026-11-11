import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { dbHealthy } from "@/lib/health";

// Healthcheck. Dış izleme (UptimeRobot vb.) DB'SİZ olanı kullanmalıdır: GET /api/health
// "?db=1" her çağrıda Neon'a SELECT 1 atar ve boştaki veritabanını uyanık tutar (hesap saati tüketir); yalnızca elle/seyrek kontrol içindir.
// Yanıtta sürüm, ortam ya da değişken bilgisi yoktur.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const rl = rateLimit(req, "health", 30, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);

  if (new URL(req.url).searchParams.get("db") !== "1") return Response.json({ ok: true }, { headers: NO_STORE });

  const db = await dbHealthy(() => prisma.$queryRaw`SELECT 1`);
  return Response.json({ ok: db, db }, { status: db ? 200 : 503, headers: NO_STORE });
}

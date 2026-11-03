import { NextResponse } from "next/server";
import { revalidateStorefront } from "@/lib/revalidate";
import { serverError } from "@/lib/api-error";
import { adminGuard } from "@/lib/admin-guard";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { applyPlan, buildPlan, parseSettings } from "@/lib/trendyol-sync";
import { onizleme } from "@/lib/trendyol-plan";

// Vercel Hobby (Fluid Compute) üst sınırı 300 sn; Trendyol sayfalama + toplu yazma bu sınıra sığdırılır.
export const maxDuration = 300;

// dryRun: Trendyol'dan OKUR, hiçbir şey yazmaz, planı döner. Uygulama: plan SUNUCUDA yeniden hesaplanır (istemci planına güvenilmez),
// yalnızca seciliUrunler (productMainId listesi; verilmezse tümü) uygulanır.
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-trendyol-sync", 5, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const body = await req.json().catch(() => ({}));
  const ayarlar = parseSettings(body.ayarlar);
  const secili = Array.isArray(body.seciliUrunler) ? body.seciliUrunler.filter((x: unknown): x is string => typeof x === "string") : undefined;
  try {
    const plan = await buildPlan(ayarlar);
    if (body.dryRun !== false) return NextResponse.json({ success: true, dryRun: true, plan: onizleme(plan) });
    const sonuc = await applyPlan(plan, secili);
    revalidateStorefront(); // vitrin yalnızca gerçek uygulamadan sonra yenilenir (önizleme yazmaz, önbelleği sıfırlamaz)
    return NextResponse.json({ success: true, dryRun: false, sonuc, sayac: plan.sayac });
  } catch (error) {
    return serverError("admin/trendyol/sync", error, "Trendyol senkronizasyonu başarısız oldu. Lütfen tekrar deneyin.", 502);
  }
}


import { NextResponse } from "next/server";
import { revalidateStorefront } from "@/lib/revalidate";
import { serverError } from "@/lib/api-error";
import { adminGuard } from "@/lib/admin-guard";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { applyPlan, buildPlan, parseSettings } from "@/lib/trendyol-sync";
import { onizleme } from "@/lib/trendyol-plan";
import { prisma } from "@/lib/db";
import { isDefaultModes, parseModesStrict } from "@/lib/trendyol-modes";

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

// Alan modlarını KAYDET: yalnızca formu önceden doldurur; eşitleme yine önizleme + onay ister, hiçbir şey otomatik çalışmaz.
// SiteConfig.homepageConfig.trendyolSyncModes (şemasız); varsayılana eşitse kayıt silinir. Vitrini etkilemez (revalidate yok).
export async function PUT(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-trendyol-modes", 30, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const body = await req.json().catch(() => null);
  const modes = parseModesStrict(body?.ayarlar);
  if (!modes) return NextResponse.json({ error: "Geçersiz ayar." }, { status: 400 });
  try {
    await prisma.$transaction(async (tx) => {
      const cur = (await tx.siteConfig.findUnique({ where: { id: 1 }, select: { homepageConfig: true } }))?.homepageConfig;
      const cfg: Record<string, unknown> = cur && typeof cur === "object" && !Array.isArray(cur) ? { ...(cur as Record<string, unknown>) } : {};
      if (isDefaultModes(modes)) delete cfg.trendyolSyncModes;
      else cfg.trendyolSyncModes = modes;
      await tx.siteConfig.upsert({ where: { id: 1 }, create: { id: 1, homepageConfig: cfg as object }, update: { homepageConfig: cfg as object } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("admin/trendyol/modes", error);
  }
}


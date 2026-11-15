import { NextResponse } from "next/server";
import { revalidateStorefront } from "@/lib/revalidate";
import { TrendyolTimeoutError } from "@/lib/trendyol";
import { serverError } from "@/lib/api-error";
import { adminGuard } from "@/lib/admin-guard";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { applyPlan, buildPlan, parseSettings, sifirlaKalkan } from "@/lib/trendyol-sync";
import { onizleme } from "@/lib/trendyol-plan";
import { prisma } from "@/lib/db";
import { TrendyolGuardError } from "@/lib/trendyol-guard";
import { OPEN_ORDER_STATUSES, pendingByBarcode, stockChangeVariationIds, sumPendingByVariation } from "@/lib/trendyol-bekleyen";
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
  // Uygulamada ayarlar tam ve geçerli olmak zorunda: eksik grup sessizce "Koruyarak" sayılmaz. Önizleme eksik ayarla yalnız bilgi verir.
  const strict = parseModesStrict(body.ayarlar);
  if (body.dryRun === false && !strict) return NextResponse.json({ error: "Eşitleme ayarları eksik veya geçersiz; hiçbir şey uygulanmadı. Sayfayı yenileyip ayarları yeniden seçin." }, { status: 400 });
  const ayarlar = strict ?? parseSettings(body.ayarlar);
  const secili = Array.isArray(body.seciliUrunler) ? body.seciliUrunler.filter((x: unknown): x is string => typeof x === "string") : undefined;
  // Kapalı renkleri sıfırla: yalnız açıkça işaretlenen {varyasyonId, stok} çiftleri (varsayılan boş = hiçbir şey sıfırlanmaz)
  const sifirla = Array.isArray(body.sifirlaVaryasyonlar)
    ? body.sifirlaVaryasyonlar.filter((x: unknown): x is { varyasyonId: string; stok: number } => !!x && typeof x === "object" && typeof (x as { varyasyonId?: unknown }).varyasyonId === "string" && Number.isInteger((x as { stok?: unknown }).stok)).slice(0, 500)
    : [];
  try {
    const plan = await buildPlan(ayarlar);
    if (body.dryRun !== false) {
      // Yalnız UYARI: stok değişikliği olan varyasyonlarda sitede bekleyen (stoğu düşülmüş, açık) sipariş adedi; stok formülü ve yazma değişmez
      const ids = stockChangeVariationIds(plan.products);
      const items = ids.length
        ? await prisma.orderItem.findMany({
            where: { variationId: { in: ids }, order: { stockDeducted: true, status: { in: [...OPEN_ORDER_STATUSES] } } },
            select: { variationId: true, quantity: true, order: { select: { status: true, stockDeducted: true } } },
          })
        : [];
      const bekleyen = pendingByBarcode(plan.products, sumPendingByVariation(items));
      return NextResponse.json({ success: true, dryRun: true, plan: { ...onizleme(plan), bekleyen, kalkanVaryasyonlar: plan.kalkan } });
    }
    const sonuc = await applyPlan(plan, secili);
    const sifirlama = sifirla.length ? await sifirlaKalkan(plan.kalkan, sifirla) : undefined;
    revalidateStorefront(); // vitrin yalnızca gerçek uygulamadan sonra yenilenir (önizleme yazmaz, önbelleği sıfırlamaz)
    return NextResponse.json({ success: true, dryRun: false, sonuc, sifirlama, sayac: plan.sayac });
  } catch (error) {
    if (error instanceof TrendyolGuardError) return NextResponse.json({ error: error.message }, { status: 422 });
    return serverError("admin/trendyol/sync", error, error instanceof TrendyolTimeoutError ? error.message : "Trendyol senkronizasyonu başarısız oldu. Lütfen tekrar deneyin.", 502);
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


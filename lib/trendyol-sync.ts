import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { buildIncoming, fetchTrendyolProducts } from "@/lib/trendyol";
import { assertIncomingSane } from "@/lib/trendyol-guard";
import { kalkanPlani, kalkanSifirlaSecimi, type KalkanSonuc, type SifirlaAtlanan, type SifirlaIstek, type SifirlaSatir } from "@/lib/trendyol-kalkan";
import { applyImageMaps } from "@/lib/image-map";
import { GROUPS, planSync, seciliPlan, type ExistingProduct, type Mode, type Plan, type ProductPlan, type Settings } from "@/lib/trendyol-plan";

const CHUNK = 100;
type Json = Prisma.InputJsonValue;

/** İstekten gelen ayarları doğrular; eksik/geçersiz alan KEEP olur. */
export function parseSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = {} as Settings;
  for (const g of GROUPS) {
    const v = r[g];
    out[g] = v === "SKIP" || v === "OVERWRITE" || v === "KEEP" ? (v as Mode) : "KEEP";
  }
  return out;
}

/** Trendyol'dan OKUR (yazmaz), mevcut ürünlerle karşılaştırıp planı üretir. Önizleme ve uygulama aynı fonksiyonu kullanır. */
export async function buildPlan(ayarlar: Settings): Promise<Plan & { kalkan: KalkanSonuc }> {
  const ham = await fetchTrendyolProducts();
  const gelen = buildIncoming(ham);
  // Yanıtta VAR ama gelen listeye alınmayan (kapalı/arşiv/kara liste/fiyat 0) barkodlar: "KESİN kapalı"; yanıtta hiç yoksa "ZAYIF"
  const gelenKodlar = new Set(gelen.flatMap((p) => p.variations.map((v) => v.barcode)));
  const kapaliBarkodlar = new Set(ham.filter((i) => i.barcode && !gelenKodlar.has(i.barcode)).map((i) => i.barcode));
  const rows = await prisma.product.findMany({
    where: { trendyolMainId: { not: null } },
    select: {
      id: true, trendyolMainId: true, title: true, description: true, category: true, basePrice: true, listPrice: true, images: true, active: true,
      brand: true, trendyolCategory: true, trendyolUrl: true, syncSnapshot: true,
      variations: { select: { id: true, barcode: true, variationValue: true, extraPrice: true, stock: true, stockCode: true, salePrice: true, listPrice: true, syncStock: true, syncSnapshot: true } },
    },
  });
  // Eksik/boş Trendyol listesi (ör. bozuk yanıt) asla "kalkan ürün" gibi işlenmez: önce akıl sağlığı denetimi
  assertIncomingSane(gelen.length, rows.length);
  // Blob'a kopyalanmış görseller: Trendyol adresleri ürünün imageMap'iyle çevrilir (kopyalar geri ezilmez)
  const { incoming, existing: mevcut } = applyImageMaps(gelen, rows as unknown as ExistingProduct[]);
  const reserved = await prisma.orderItem.groupBy({
    by: ["variationId"],
    _sum: { quantity: true },
    where: { order: { stockDeducted: true, status: "AWAITING_PAYMENT", paymentMethod: "CREDIT_CARD" } },
  });
  const rezerve: Record<string, number> = {};
  for (const r of reserved) rezerve[r.variationId] = r._sum.quantity ?? 0;
  // Kalkan varyasyonlar YALNIZ gösterilir (stok yazılmaz); planSync çıktısı ve formüller değişmez
  return { ...planSync(mevcut, incoming, ayarlar, rezerve), kalkan: kalkanPlani(mevcut, incoming, kapaliBarkodlar, rezerve, ayarlar) };
}

export interface ApplyResult { guncellenenUrun: number; yeniUrun: number; yeniVaryasyon: number; stokGuncellenen: number; atlanan: number; hata: number; hataliUrunler: { id: string; baslik: string }[] }

/** Sonuç nesnesine yazılacak en çok ürün sayısı (mesajı şişirmemek için). */
export const HATALI_URUN_LIMIT = 20;

async function inChunks<T>(items: T[], run: (chunk: T[]) => Promise<void>, onFail?: (chunk: T[]) => void): Promise<number> {
  let failed = 0;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    try {
      await run(chunk);
    } catch (e) {
      failed += chunk.length;
      onFail?.(chunk);
      console.error("[trendyol-sync] grup hatası:", (e as Error).message);
    }
  }
  return failed;
}

/** Stok: tek atomik UPDATE (oku-sonra-yaz yarışı yok). KEEP: stok'u Trendyol farkı kadar kaydırır; OVERWRITE: T − açık rezervasyon. */
async function writeStock(mode: "KEEP" | "OVERWRITE", rows: { id: string; t: number }[]) {
  const values = Prisma.join(rows.map((r) => Prisma.sql`(${r.id}::text, ${r.t}::int)`));
  if (mode === "KEEP") {
    await prisma.$executeRaw`UPDATE "ProductVariation" v SET "stock" = GREATEST(0, x.t + (v."stock" - COALESCE(v."syncStock", x.t))), "syncStock" = x.t FROM (VALUES ${values}) AS x(id, t) WHERE v."id" = x.id`;
  } else {
    await prisma.$executeRaw`UPDATE "ProductVariation" v SET "stock" = GREATEST(0, x.t - COALESCE((SELECT SUM(oi."quantity") FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId" WHERE oi."variationId" = v."id" AND o."stockDeducted" = true AND o."status" = 'AWAITING_PAYMENT' AND o."paymentMethod" = 'CREDIT_CARD'), 0)::int), "syncStock" = x.t FROM (VALUES ${values}) AS x(id, t) WHERE v."id" = x.id`;
  }
}

/** Planı (sunucuda yeniden hesaplanmış) uygular: yalnızca seçili ürünler. Toplu sorgularla; yalnızca değişenler yazılır. */
export async function applyPlan(plan: Plan, secili?: string[]): Promise<ApplyResult> {
  const chosen: ProductPlan[] = seciliPlan(plan, secili);
  const now = new Date();
  const res: ApplyResult = { guncellenenUrun: 0, yeniUrun: 0, yeniVaryasyon: 0, stokGuncellenen: 0, atlanan: plan.products.length - chosen.length, hata: 0, hataliUrunler: [] };
  // Düşen gruptaki ürünlerin kimlik/başlık listesi (kişisel veri yok; en çok HATALI_URUN_LIMIT)
  const fail = new Map<string, string>();
  const note = (id: string, baslik: string) => { if (fail.size < HATALI_URUN_LIMIT) fail.set(id, baslik); };
  const noteP = (p: ProductPlan) => note(p.id ?? p.mainId, p.title);
  const ownerByVar = new Map<string, ProductPlan>();
  const ownerByPid = new Map<string, ProductPlan>();
  for (const p of chosen) {
    if (p.id) ownerByPid.set(p.id, p);
    for (const v of p.variations) if (v.id) ownerByVar.set(v.id, p);
  }

  // 1) Yeni ürünler ve (mevcut ürünlere) yeni varyasyonlar
  const newProducts = chosen.filter((p) => p.create);
  const productRows = newProducts.map((p) => ({ ...(p.create!.data as Prisma.ProductCreateManyInput), id: randomUUID(), trendyolMainId: p.mainId, syncSnapshot: p.create!.snapshot as Json, lastSyncedAt: now }));
  const idOf = new Map(newProducts.map((p, i) => [p.mainId, productRows[i].id as string]));
  const byMain = new Map(newProducts.map((p) => [p.mainId, p]));
  // Yalnızca BAŞARIYLA eklenen yeni ürünlerin kimlikleri tutulur: ürün eklenemediyse varyasyonları eklenmez (FK hatası ilgisiz varyasyonların grubunu da düşürürdü); ürün hatası zaten hata sayacındadır
  const created = new Set<string>();
  res.hata += await inChunks(productRows, async (c) => { await prisma.product.createMany({ data: c, skipDuplicates: true }); res.yeniUrun += c.length; for (const r of c) created.add(r.id as string); }, (c) => c.forEach((r) => { const p = byMain.get(r.trendyolMainId as string); if (p) noteP(p); }));
  const varRows: Prisma.ProductVariationCreateManyInput[] = [];
  for (const p of chosen) {
    const pid = p.id ?? idOf.get(p.mainId);
    if (!pid || (!p.id && !created.has(pid))) continue;
    if (!p.id) ownerByPid.set(pid, p);
    for (const v of p.variations) {
      if (!v.create) continue;
      varRows.push({ ...(v.create.data as Prisma.ProductVariationCreateManyInput), productId: pid, variationType: "Seçenek", syncSnapshot: v.create.snapshot as Json, syncStock: v.create.syncStock });
    }
  }
  res.hata += await inChunks(varRows, async (c) => { await prisma.productVariation.createMany({ data: c, skipDuplicates: true }); res.yeniVaryasyon += c.length; }, (c) => c.forEach((r) => { const p = ownerByPid.get(r.productId); if (p) noteP(p); }));

  // 2) Mevcut ürün alanları + anlık görüntü
  const pWrites = chosen.filter((p) => p.id && p.write);
  res.hata += await inChunks(pWrites, async (c) => {
    await prisma.$transaction(
      c.map((p) =>
        prisma.product.update({
          where: { id: p.id! },
          data: { ...(p.write!.data as Prisma.ProductUpdateInput), ...(p.write!.snapshot ? { syncSnapshot: p.write!.snapshot as Json } : {}), lastSyncedAt: now },
        }),
      ),
    );
    res.guncellenenUrun += c.filter((p) => p.degerYazar).length;
  }, (c) => c.forEach(noteP));

  // 3) Varyasyon alanları + anlık görüntü (stok hariç)
  const vWrites = chosen.flatMap((p) => p.variations.filter((v) => v.id && v.write && (Object.keys(v.write.data).length > 0 || v.write.snapshot)));
  res.hata += await inChunks(vWrites, async (c) => {
    await prisma.$transaction(
      c.map((v) =>
        prisma.productVariation.update({
          where: { id: v.id! },
          data: { ...(v.write!.data as Prisma.ProductVariationUpdateInput), ...(v.write!.snapshot ? { syncSnapshot: v.write!.snapshot as Json } : {}) },
        }),
      ),
    );
  }, (c) => c.forEach((v) => { const p = ownerByVar.get(v.id!); if (p) noteP(p); }));

  // 4) Stok: iki mod için tek atomik UPDATE ... FROM (VALUES ...)
  for (const mode of ["KEEP", "OVERWRITE"] as const) {
    const rows = chosen.flatMap((p) => p.variations.filter((v) => v.id && v.write?.stock?.mode === mode).map((v) => ({ id: v.id!, t: v.write!.stock!.t })));
    res.hata += await inChunks(rows, async (c) => { await writeStock(mode, c); res.stokGuncellenen += c.length; }, (c) => c.forEach((r) => { const p = ownerByVar.get(r.id); if (p) noteP(p); }));
  }
  res.hataliUrunler = [...fail].map(([id, baslik]) => ({ id, baslik }));
  return res;
}

export const SIFIRLANAN_LIMIT = 50;
export interface SifirlaSonuc { sifirlanan: SifirlaSatir[]; atlanan: SifirlaAtlanan[]; hata: number }

/**
 * Trendyol'da kapalı renklerin stoğunu 0 yapar (satır SİLİNMEZ): tek atomik, KOŞULLU UPDATE.
 * Yalnız satırın stoğu hâlâ önizlemedeki değerdeyse yazılır (arada satış/elle değişiklik olduysa atlanır). Boş seçimde hiçbir sorgu atılmaz.
 * syncStock=0: renk Trendyol'a dönerse KEEP formülü T+(0-0)=T doğru kurar. Eski stok sonuçta listelenir (elle geri yazım için).
 */
export async function sifirlaKalkan(kalkan: KalkanSonuc, istekler: SifirlaIstek[]): Promise<SifirlaSonuc> {
  const { uygulanacak, atlanan } = kalkanSifirlaSecimi(kalkan, istekler);
  const out: SifirlaSonuc = { sifirlanan: [], atlanan: [...atlanan], hata: 0 };
  out.hata += await inChunks(uygulanacak, async (c) => {
    const values = Prisma.join(c.map((r) => Prisma.sql`(${r.varyasyonId}::text, ${r.eskiStok}::int)`));
    const yazilan = await prisma.$queryRaw<{ id: string }[]>`UPDATE "ProductVariation" v SET "stock" = 0, "syncStock" = 0 FROM (VALUES ${values}) AS x(id, beklenen) WHERE v."id" = x.id AND v."stock" = x.beklenen AND v."stock" > 0 RETURNING v."id"`;
    const ok = new Set(yazilan.map((r) => r.id));
    for (const r of c) {
      if (ok.has(r.varyasyonId)) out.sifirlanan.push(r);
      else out.atlanan.push({ varyasyonId: r.varyasyonId, neden: "STOK_DEGISTI" });
    }
  });
  out.sifirlanan = out.sifirlanan.slice(0, SIFIRLANAN_LIMIT);
  return out;
}

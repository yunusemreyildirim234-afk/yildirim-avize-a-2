import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { signSession, verifySession } from "@/lib/session";
import { bulkTiersOf } from "@/lib/bulk-pricing";
import { productUploadIds } from "@/lib/variation-input";

// Yönetici "Geri Al" altyapısı.
//  - Sunucu işlemden SONRA, işlemin gerçekten değiştirdiği alanları (önceki değerleriyle) ve stok FARKLARINI (delta) hesaplar
//    ve HMAC imzalı, 30 dk geçerli bir belirteç (token) olarak istemciye verir. İstemci belirteci değiştiremez.
//  - Geri alırken belirteç doğrulanır, yük (payload) yine de katı biçimde denetlenir; yalnızca bilinen alanlar yazılır.
//  - Stok mutlak değerle değil ters deltayla (atomik, negatife düşmeden) geri alınır; yetmezse geri alma reddedilir.
//  - İşlemden sonra ürün başka yerde değiştiyse (updatedAt farklı) kullanıcı uyarılır (force ile devam edilebilir).
// Bilinen sınır: belirteç tek kullanımlık değildir (sunucusuz ortamda paylaşılan kullanım kaydı için şema değişikliği gerekir);
// istemci başarıdan sonra belirteci siler. Aynı belirteci elle tekrar göndermek stok deltasını ikinci kez uygular, ancak stok yine negatife düşmez.

export const UNDO_TTL_MS = 30 * 60_000;

/** Kullanıcıya gösterilecek, beklenen (reddetme/uyarı) hatası. */
export class UndoError extends Error {
  constructor(public status: number, message: string, public conflict = false) {
    super(message);
  }
}

// ---------- Durum okuma ----------
const FIELD_KEYS = ["title", "category", "basePrice", "listPrice", "isFeatured", "isBestSeller", "bulkTiers", "modelCode", "images", "imageUrl", "active", "couponAllowed", "pickupDiscountPct", "transferDiscountPct"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];
type Fields = Partial<Record<FieldKey, unknown>>;

export interface ProductState {
  id: string;
  fields: Record<FieldKey, unknown>;
  variations: { id: string; stock: number; extraPrice: number }[];
}

export async function snapshotProducts(ids: string[]): Promise<ProductState[]> {
  const rows = await prisma.product.findMany({ where: { id: { in: ids } }, include: { variations: { select: { id: true, stock: true, extraPrice: true } } } });
  return rows.map((p) => ({
    id: p.id,
    fields: { title: p.title, category: p.category, basePrice: p.basePrice, listPrice: p.listPrice, isFeatured: p.isFeatured, isBestSeller: p.isBestSeller, bulkTiers: p.bulkTiers, modelCode: p.modelCode, images: p.images, imageUrl: p.imageUrl, active: p.active, couponAllowed: p.couponAllowed, pickupDiscountPct: p.pickupDiscountPct, transferDiscountPct: p.transferDiscountPct },
    variations: p.variations,
  }));
}

/** Silinecek ürünün tam kopyası (geri alma için). */
export async function snapshotForDelete(productId: string): Promise<UndoExtra> {
  const p = await prisma.product.findUnique({ where: { id: productId }, include: { variations: true } });
  if (!p) return {};
  const { variations, ...product } = p;
  return { recreate: [{ product: JSON.parse(JSON.stringify(product)), variations: JSON.parse(JSON.stringify(variations)) }] };
}

export interface UndoExtra {
  deleteVariationIds?: string[];
  recreate?: { product: Record<string, unknown>; variations: Record<string, unknown>[] }[];
}

interface UndoPayload extends Record<string, unknown> {
  kind: "undo";
  iat: number;
  products: { id: string; fields: Fields; afterUpdatedAt: string | null }[];
  variations: { id: string; stockDelta?: number; extraPrice?: number }[];
  deleteVariationIds: string[];
  recreate: { product: Record<string, unknown>; variations: Record<string, unknown>[] }[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** İşlem SONRASI çağrılır: gerçekten değişenleri hesaplar ve imzalı belirteç döndürür (değişiklik yoksa null). */
export async function buildUndoToken(before: ProductState[], extra: UndoExtra = {}): Promise<string | null> {
  const now = await snapshotProducts(before.map((b) => b.id));
  const nowById = new Map(now.map((n) => [n.id, n]));
  const stamps = await prisma.product.findMany({ where: { id: { in: before.map((b) => b.id) } }, select: { id: true, updatedAt: true } });
  const stampOf = new Map(stamps.map((s) => [s.id, s.updatedAt.toISOString()]));

  const payload: UndoPayload = { kind: "undo", iat: Date.now(), products: [], variations: [], deleteVariationIds: extra.deleteVariationIds ?? [], recreate: extra.recreate ?? [] };
  for (const b of before) {
    const cur = nowById.get(b.id);
    if (!cur) continue; // silindi: recreate ile geri alınır
    const fields: Fields = {};
    for (const k of FIELD_KEYS) if (!same(b.fields[k], cur.fields[k])) fields[k] = b.fields[k];
    if (Object.keys(fields).length) payload.products.push({ id: b.id, fields, afterUpdatedAt: stampOf.get(b.id) ?? null });
    const curVar = new Map(cur.variations.map((v) => [v.id, v]));
    for (const v of b.variations) {
      const c = curVar.get(v.id);
      if (!c) continue;
      const entry: { id: string; stockDelta?: number; extraPrice?: number } = { id: v.id };
      if (c.stock !== v.stock) entry.stockDelta = c.stock - v.stock;
      if (c.extraPrice !== v.extraPrice) entry.extraPrice = v.extraPrice;
      if (entry.stockDelta !== undefined || entry.extraPrice !== undefined) payload.variations.push(entry);
    }
  }
  if (!payload.products.length && !payload.variations.length && !payload.deleteVariationIds.length && !payload.recreate.length) return null;
  return signSession({ ...payload });
}

// ---------- Doğrulama ----------
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const bad = (what: string): never => {
  throw new UndoError(400, `Geri alma kaydı geçersiz (${what}).`);
};
const str = (v: unknown, max: number, what: string, nullable = false): string | null => {
  if (v === null && nullable) return null;
  if (typeof v !== "string" || v.length > max) return bad(what);
  return v;
};
const num = (v: unknown, what: string, nullable = false, int = false): number | null => {
  if (v === null && nullable) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1e9 || (int && !Number.isInteger(v))) return bad(what);
  return v;
};
const pct = (v: unknown, what: string): number | null => {
  const n = num(v, what, true);
  if (n !== null && n > 100) bad(what);
  return n;
};
const bool = (v: unknown, what: string): boolean => (typeof v === "boolean" ? v : (bad(what) as never));
const id = (v: unknown, what: string): string => (typeof v === "string" && ID_RE.test(v) ? v : (bad(what) as never));
const images = (v: unknown): string[] => {
  if (!Array.isArray(v) || v.length > 20) return bad("images");
  return v.map((u) => (typeof u === "string" && u.length <= 1000 && /^(https?:\/\/|\/)/.test(u) ? u : (bad("images") as never)));
};
const tiers = (v: unknown) => {
  if (v === null) return null;
  const list = bulkTiersOf(v);
  if (Array.isArray(v) && list.length !== v.length) bad("bulkTiers");
  return list;
};
const date = (v: unknown, what: string): Date => {
  const d = typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : (bad(what) as never);
};

function cleanFields(raw: unknown): Fields {
  if (!isObj(raw)) return bad("fields");
  const out: Fields = {};
  for (const [k, v] of Object.entries(raw)) {
    switch (k as FieldKey) {
      case "title": out.title = str(v, 300, k); break;
      case "category": out.category = str(v, 80, k); break;
      case "basePrice": out.basePrice = num(v, k); break;
      case "listPrice": out.listPrice = num(v, k, true); break;
      case "isFeatured": out.isFeatured = bool(v, k); break;
      case "isBestSeller": out.isBestSeller = bool(v, k); break;
      case "bulkTiers": out.bulkTiers = tiers(v); break;
      case "modelCode": out.modelCode = str(v, 40, k, true); break;
      case "images": out.images = images(v); break;
      case "imageUrl": out.imageUrl = str(v, 1000, k, true); break;
      case "active": out.active = bool(v, k); break;
      case "couponAllowed": out.couponAllowed = bool(v, k); break;
      case "pickupDiscountPct": out.pickupDiscountPct = pct(v, k); break;
      case "transferDiscountPct": out.transferDiscountPct = pct(v, k); break;
      default: bad(`bilinmeyen alan: ${k}`);
    }
  }
  return out;
}

function cleanRecreate(raw: unknown) {
  if (!Array.isArray(raw) || raw.length > 5) return bad("recreate");
  return raw.map((r) => {
    if (!isObj(r) || !isObj(r.product) || !Array.isArray(r.variations) || r.variations.length > 200) return bad("recreate");
    const p = r.product;
    const pid = id(p.id, "product.id");
    const product: Prisma.ProductUncheckedCreateInput = {
      id: pid,
      title: str(p.title, 300, "title") as string,
      description: str(p.description ?? null, 20000, "description", true),
      category: str(p.category, 80, "category") as string,
      basePrice: num(p.basePrice, "basePrice") as number,
      imageUrl: str(p.imageUrl ?? null, 1000, "imageUrl", true),
      images: images(p.images ?? []),
      active: bool(p.active, "active"),
      brand: str(p.brand ?? null, 200, "brand", true),
      listPrice: num(p.listPrice ?? null, "listPrice", true),
      isFeatured: bool(p.isFeatured ?? false, "isFeatured"),
      isBestSeller: bool(p.isBestSeller ?? false, "isBestSeller"),
      couponAllowed: bool(p.couponAllowed ?? true, "couponAllowed"),
      pickupDiscountPct: pct(p.pickupDiscountPct ?? null, "pickupDiscountPct"),
      transferDiscountPct: pct(p.transferDiscountPct ?? null, "transferDiscountPct"),
      bulkTiers: jsonOrNull(tiers(p.bulkTiers ?? null)),
      trendyolMainId: str(p.trendyolMainId ?? null, 100, "trendyolMainId", true),
      modelCode: str(p.modelCode ?? null, 40, "modelCode", true),
      trendyolCategory: str(p.trendyolCategory ?? null, 300, "trendyolCategory", true),
      trendyolUrl: str(p.trendyolUrl ?? null, 1000, "trendyolUrl", true),
      createdAt: date(p.createdAt, "createdAt"),
      updatedAt: date(p.updatedAt, "updatedAt"),
    };
    const variations: Prisma.ProductVariationCreateManyInput[] = r.variations.map((v) => {
      if (!isObj(v)) return bad("variation");
      if (v.productId !== pid) return bad("variation.productId");
      return {
        id: id(v.id, "variation.id"),
        productId: pid,
        variationType: str(v.variationType, 200, "variationType") as string,
        variationValue: str(v.variationValue, 200, "variationValue") as string,
        extraPrice: num(v.extraPrice, "extraPrice") as number,
        stock: num(v.stock, "stock", false, true) as number,
        barcode: str(v.barcode ?? null, 100, "barcode", true),
        stockCode: str(v.stockCode ?? null, 100, "stockCode", true),
        salePrice: num(v.salePrice ?? null, "salePrice", true),
        listPrice: num(v.listPrice ?? null, "listPrice", true),
        images: images(v.images ?? []),
        position: num(v.position ?? 0, "position", false, true) as number,
      };
    });
    return { product, variations };
  });
}

const jsonOrNull = (v: unknown) => (v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue));

/** İmzayı ve süreyi doğrular, yükü katı biçimde temizler. */
export async function readUndoToken(token: unknown) {
  if (typeof token !== "string" || token.length > 1_000_000) throw new UndoError(400, "Geri alınacak kayıt yok.");
  const p = await verifySession<UndoPayload>(token);
  if (!p || p.kind !== "undo" || typeof p.iat !== "number") throw new UndoError(400, "Geri alma kaydı geçersiz veya değiştirilmiş.");
  if (Date.now() - p.iat > UNDO_TTL_MS) throw new UndoError(410, "Geri alma süresi (30 dk) doldu.");

  if (!Array.isArray(p.products) || p.products.length > 2000 || !Array.isArray(p.variations) || p.variations.length > 20000) return bad("liste");
  return {
    products: p.products.map((x) => {
      if (!isObj(x)) return bad("product");
      return { id: id(x.id, "product.id"), fields: cleanFields(x.fields), afterUpdatedAt: x.afterUpdatedAt === null ? null : date(x.afterUpdatedAt, "afterUpdatedAt").toISOString() };
    }),
    variations: p.variations.map((v) => {
      if (!isObj(v)) return bad("variation");
      const out: { id: string; stockDelta?: number; extraPrice?: number } = { id: id(v.id, "variation.id") };
      if (v.stockDelta !== undefined) {
        if (typeof v.stockDelta !== "number" || !Number.isInteger(v.stockDelta) || Math.abs(v.stockDelta) > 1e7) bad("stockDelta");
        out.stockDelta = v.stockDelta as number;
      }
      if (v.extraPrice !== undefined) out.extraPrice = num(v.extraPrice, "extraPrice") as number;
      return out;
    }),
    deleteVariationIds: (Array.isArray(p.deleteVariationIds) ? p.deleteVariationIds : (bad("deleteVariationIds") as never)).slice(0, 5000).map((x: unknown) => id(x, "deleteVariationId")),
    recreate: cleanRecreate(p.recreate ?? []),
  };
}

// ---------- Geri yazma ----------
export async function restoreFromToken(token: unknown, force: boolean): Promise<number> {
  const snap = await readUndoToken(token);

  const productIds = snap.products.map((p) => p.id);
  const current = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true, updatedAt: true } });
  const cur = new Map(current.map((c) => [c.id, c]));
  const missing = productIds.filter((i) => !cur.has(i));
  if (missing.length) throw new UndoError(409, `${missing.length} ürün artık mevcut değil; geri alınamadı.`);

  // Fiyat/isim/vitrin vb. alanlar: işlemden sonra ürün başka yerde değiştiyse uyar
  if (!force) {
    const changed = snap.products.filter((p) => p.afterUpdatedAt && cur.get(p.id)!.updatedAt.toISOString() !== p.afterUpdatedAt);
    if (changed.length) {
      const names = changed.slice(0, 3).map((p) => `"${cur.get(p.id)!.title}"`).join(", ");
      throw new UndoError(409, `Bu işlemden sonra ${changed.length} ürün başka bir yerde değiştirilmiş (${names}${changed.length > 3 ? ", ..." : ""}). Geri alırsanız o sonraki değişiklikler de ezilebilir.`, true);
    }
  }

  const varIds = snap.variations.map((v) => v.id);
  const existing = await prisma.productVariation.findMany({ where: { id: { in: varIds } }, select: { id: true, variationValue: true, stock: true, product: { select: { title: true } } } });
  const exMap = new Map(existing.map((v) => [v.id, v]));
  if (varIds.some((v) => !exMap.has(v))) throw new UndoError(409, "Bazı varyasyonlar artık mevcut değil; geri alınamadı.");

  let restored = 0;
  await prisma.$transaction(async (tx) => {
    for (const p of snap.products) {
      const data: Prisma.ProductUpdateInput = {};
      for (const [k, v] of Object.entries(p.fields)) (data as Record<string, unknown>)[k] = k === "bulkTiers" ? jsonOrNull(v) : v;
      await tx.product.update({ where: { id: p.id }, data });
      restored++;
    }
    for (const v of snap.variations) {
      if (v.extraPrice !== undefined) await tx.productVariation.update({ where: { id: v.id }, data: { extraPrice: v.extraPrice } });
      if (v.stockDelta) {
        // Ters delta: atomik ve negatife düşmeyi engeller (arada siparişle stok azaldıysa reddedilir)
        const n = await tx.$executeRaw`UPDATE "ProductVariation" SET "stock" = "stock" - ${v.stockDelta} WHERE "id" = ${v.id} AND "stock" - ${v.stockDelta} >= 0`;
        if (n === 0) {
          const e = exMap.get(v.id)!;
          throw new UndoError(409, `Stok geri alınamadı: "${e.product.title}" / ${e.variationValue} için mevcut stok (${e.stock}) yetersiz. Arada satış olmuş olabilir.`);
        }
      }
    }
    if (snap.deleteVariationIds.length) await tx.productVariation.deleteMany({ where: { id: { in: snap.deleteVariationIds }, orderItems: { none: {} } } });
    for (const r of snap.recreate) {
      const exists = await tx.product.findUnique({ where: { id: r.product.id }, select: { id: true } });
      if (exists) continue;
      await tx.product.create({ data: r.product });
      if (r.variations.length) await tx.productVariation.createMany({ data: r.variations });
      // Silinirken ProductImage satırları ürüne bağsız bırakıldı (cascade'den kurtarıldı); geri alınca yeniden bağlanır
      const uploadIds = productUploadIds({ images: r.product.images as string[], imageUrl: r.product.imageUrl as string | null }, r.variations.map((v) => ({ images: v.images as string[] })));
      if (uploadIds.length) await tx.productImage.updateMany({ where: { id: { in: uploadIds }, productId: null }, data: { productId: r.product.id as string } });
      restored++;
    }
  });
  return restored;
}


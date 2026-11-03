import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildUndoToken, snapshotProducts, type UndoExtra } from "@/lib/admin-undo";
import { bulkTiersOf, upsertTier } from "@/lib/bulk-pricing";

// Seçili ürünlerde toplu işlem: stok, isim, renk ekleme, koleksiyon (proxy yalnızca yöneticiye açar)
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  // "Tüm ürünler" yalnızca özel indirim kurallarında desteklenir
  const allProducts = body.all === true && body.action === "specialDiscount";
  const ids: string[] = allProducts
    ? (await prisma.product.findMany({ select: { id: true }, take: 2000 })).map((p) => p.id)
    : Array.isArray(body.ids)
      ? [...new Set<string>(body.ids.filter((i: unknown): i is string => typeof i === "string"))].slice(0, 500)
      : [];
  if (ids.length === 0) return NextResponse.json({ error: "Ürün seçilmedi." }, { status: 400 });

  // Geri Al için işlem öncesi durum
  const before = await snapshotProducts(ids);
  const extra: UndoExtra = {};
  const done = () => buildUndoToken(before, extra);

  switch (body.action) {
    case "stock": {
      const value = Math.floor(Number(body.value));
      if (!Number.isFinite(value)) return NextResponse.json({ error: "Geçerli bir sayı giriniz." }, { status: 400 });
      if (body.mode === "set") {
        if (value < 0) return NextResponse.json({ error: "Stok negatif olamaz." }, { status: 400 });
        const res = await prisma.productVariation.updateMany({ where: { productId: { in: ids } }, data: { stock: value } });
        return NextResponse.json({ snapshot: await done(), success: true, updated: res.count });
      }
      // Artırma/azaltma: 0'ın altına inmez
      const res = await prisma.$executeRaw`UPDATE "ProductVariation" SET "stock" = GREATEST(0, "stock" + ${value}) WHERE "productId" = ANY(${ids})`;
      return NextResponse.json({ snapshot: await done(), success: true, updated: res });
    }

    case "rename": {
      const prefix = typeof body.prefix === "string" ? body.prefix : "";
      const suffix = typeof body.suffix === "string" ? body.suffix : "";
      if (!prefix.trim() && !suffix.trim()) return NextResponse.json({ error: "Ön ek veya son ek giriniz." }, { status: 400 });
      const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
      await prisma.$transaction(
        products.map((p: { id: string; title: string }) =>
          prisma.product.update({ where: { id: p.id }, data: { title: `${prefix}${p.title}${suffix}`.replace(/\s+/g, " ").trim().slice(0, 300) } })
        )
      );
      return NextResponse.json({ snapshot: await done(), success: true, updated: products.length });
    }

    case "addVariation": {
      const value = typeof body.variationValue === "string" ? body.variationValue.trim().slice(0, 100) : "";
      const stock = Math.max(0, Math.floor(Number(body.stock) || 0));
      const extraPrice = Math.max(0, Number(body.extraPrice) || 0);
      if (!value) return NextResponse.json({ error: "Renk adı zorunludur." }, { status: 400 });

      // Aynı renge sahip ürünler atlanır
      const existing = await prisma.productVariation.findMany({
        where: { productId: { in: ids } },
        select: { productId: true, variationValue: true },
      });
      const has = new Set<string>(
        existing
          .filter((v: { variationValue: string }) => v.variationValue.toLocaleLowerCase("tr") === value.toLocaleLowerCase("tr"))
          .map((v: { productId: string }) => v.productId)
      );
      const targets = ids.filter((id) => !has.has(id));
      const res = await prisma.productVariation.createMany({
        data: targets.map((productId) => ({ productId, variationType: "Renk", variationValue: value, stock, extraPrice })),
      });
      const created = await prisma.productVariation.findMany({ where: { productId: { in: targets }, variationType: "Renk", variationValue: value }, select: { id: true } });
      extra.deleteVariationIds = created.map((v) => v.id);
      return NextResponse.json({ snapshot: await done(), success: true, updated: res.count, skipped: ids.length - targets.length });
    }

    case "category": {
      const category = typeof body.category === "string" ? body.category.trim().slice(0, 80) : "";
      if (!category) return NextResponse.json({ error: "Koleksiyon adı zorunludur." }, { status: 400 });
      const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { category } });
      return NextResponse.json({ snapshot: await done(), success: true, updated: res.count });
    }

    // Toplu indirim: orijinal (yüksek) fiyat listPrice'ta saklanır; tekrar uygulamak indirimi üst üste bindirmez
    case "discount": {
      const mode = body.mode === "FIXED" ? "FIXED" : body.mode === "PERCENT" ? "PERCENT" : null;
      const value = Number(body.value);
      if (!mode || !Number.isFinite(value) || value <= 0) return NextResponse.json({ error: "Geçerli bir indirim değeri giriniz." }, { status: 400 });
      if (mode === "PERCENT" && value >= 100) return NextResponse.json({ error: "Yüzde 100'ün altında olmalıdır." }, { status: 400 });
      const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, basePrice: true, listPrice: true } });
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const ops = [];
      for (const p of products) {
        const original = p.listPrice && p.listPrice > p.basePrice ? p.listPrice : p.basePrice;
        const next = round2(Math.max(0, mode === "PERCENT" ? original * (1 - value / 100) : original - value));
        if (next >= original) continue;
        ops.push(prisma.product.update({ where: { id: p.id }, data: { basePrice: next, listPrice: original } }));
      }
      await prisma.$transaction(ops);
      return NextResponse.json({ snapshot: await done(), success: true, updated: ops.length, skipped: products.length - ops.length });
    }

    // Adet kademesi ekle (aynı minQty varsa üstüne yazar); normal indirime ve diğer kademelere dokunmaz
    case "tier": {
      const minQty = Math.floor(Number(body.minQty));
      const value = Number(body.value);
      const type = body.type === "FIXED" ? "FIXED" : body.type === "PERCENT" ? "PERCENT" : null;
      if (!type || !(minQty >= 2) || !(value > 0)) return NextResponse.json({ error: "En az 2 adet ve geçerli bir indirim değeri giriniz." }, { status: 400 });
      if (type === "PERCENT" && value >= 100) return NextResponse.json({ error: "Yüzde 100 altında olmalıdır." }, { status: 400 });
      const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, bulkTiers: true } });
      await prisma.$transaction(
        products.map((p) => prisma.product.update({ where: { id: p.id }, data: { bulkTiers: upsertTier(bulkTiersOf(p.bulkTiers), { minQty, type, value }) } }))
      );
      return NextResponse.json({ snapshot: await done(), success: true, updated: products.length });
    }

    // Seçici kaldırma: scope = "normal" (1 adet indirimi) | "tier" (yalnızca minQty kademesi) | "all"
    case "removeDiscount": {
      const scope = body.scope === "normal" || body.scope === "tier" ? body.scope : "all";
      const tierQty = Math.floor(Number(body.minQty));
      if (scope === "tier" && !(tierQty >= 2)) return NextResponse.json({ error: "Geçerli bir adet kademesi seçin." }, { status: 400 });
      const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, basePrice: true, listPrice: true, bulkTiers: true } });
      await prisma.$transaction(
        products.map((p) => {
          const restore = p.listPrice && p.listPrice > p.basePrice ? p.listPrice : p.basePrice;
          const tiers = bulkTiersOf(p.bulkTiers);
          const data: Prisma.ProductUpdateInput =
            scope === "normal"
              ? { basePrice: restore, listPrice: null }
              : scope === "tier"
                ? { bulkTiers: tiers.filter((t) => t.minQty !== tierQty) }
                : { basePrice: restore, listPrice: null, bulkTiers: [], bulkMinQty: null, bulkDiscountType: null, bulkDiscountValue: null };
          return prisma.product.update({ where: { id: p.id }, data });
        })
      );
      return NextResponse.json({ snapshot: await done(), success: true, updated: products.length });
    }

    // Özel indirim kuralları: kupon geçerli mi, mağazadan teslim %, Havale/EFT % (null: varsayılan, 0: bu üründe yok)
    case "specialDiscount": {
      const pctOf = (v: unknown): number | null | undefined => {
        if (v === null || v === "" || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
      };
      const pickupPct = pctOf(body.pickupPct);
      const transferPct = pctOf(body.transferPct);
      if (pickupPct === undefined || transferPct === undefined) return NextResponse.json({ error: "İndirim oranları 0 ile 100 arasında olmalıdır." }, { status: 400 });
      const data = body.reset === true
        ? { couponAllowed: true, pickupDiscountPct: null, transferDiscountPct: null }
        : { couponAllowed: body.couponAllowed !== false, pickupDiscountPct: pickupPct, transferDiscountPct: transferPct };
      const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data });
      return NextResponse.json({ snapshot: await done(), success: true, updated: res.count });
    }

    // Vitrin: Öne Çıkanlar / Çok Satanlar ekle-çıkar
    case "showcase": {
      const field = body.field === "isFeatured" || body.field === "isBestSeller" ? body.field : null;
      if (!field || typeof body.value !== "boolean") return NextResponse.json({ error: "Geçersiz vitrin işlemi." }, { status: 400 });
      const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { [field]: body.value } });
      return NextResponse.json({ snapshot: await done(), success: true, updated: res.count });
    }

    default:
      return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  }
}

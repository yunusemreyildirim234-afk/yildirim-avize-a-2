import { NextResponse } from "next/server";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { adminGuard } from "@/lib/admin-guard";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildUndoToken, snapshotProducts, type UndoExtra } from "@/lib/admin-undo";
import { bulkTiersOf, upsertTier } from "@/lib/bulk-pricing";
import { FEATURED, getBestSellers } from "@/lib/products";
import { planAddVariation, planBestSeller, planCategory, planFeatured } from "@/lib/bulk-plan";

interface Plan {
  targets: string[]; // gerçekten değişecek ürünler
  markFirst: string[]; // önce isFeatured=true yapılacaklar (otomatik Öne Çıkanlar kümesini elle işarete çevirir)
  info?: { auto: boolean; before: number; after: number; revertsToAuto: boolean };
}

/**
 * "Zaten bu durumda" kontrolü: işlemin gerçekten değiştireceği ürünleri belirler. Geçersiz girdide daralma yapmaz
 * (asıl doğrulama ve hata mesajları ilgili işlem dalındadır). Atlananlar ne yazılır ne Geri Al kaydına girer.
 */
async function planBulk(body: Record<string, unknown>, selected: string[]): Promise<Plan> {
  const all: Plan = { targets: selected, markFirst: [] };
  const rows = await prisma.product.findMany({
    where: { id: { in: selected } },
    select: { id: true, title: true, category: true, basePrice: true, listPrice: true, bulkTiers: true, bulkMinQty: true, couponAllowed: true, pickupDiscountPct: true, transferDiscountPct: true, isFeatured: true, isBestSeller: true, variations: { select: { variationValue: true, stock: true } } },
  });
  type Row = (typeof rows)[number];
  const keep = (fn: (p: Row) => boolean): Plan => ({ targets: rows.filter(fn).map((r) => r.id), markFirst: [] });
  const round2 = (n: number) => Math.round(n * 100) / 100;

  switch (body.action) {
    case "stock": {
      const value = Math.floor(Number(body.value));
      if (!Number.isFinite(value)) return all;
      if (body.mode === "set") return value < 0 ? all : keep((p) => p.variations.some((v) => v.stock !== value));
      return keep((p) => p.variations.some((v) => Math.max(0, v.stock + value) !== v.stock));
    }
    case "rename": {
      const prefix = typeof body.prefix === "string" ? body.prefix : "";
      const suffix = typeof body.suffix === "string" ? body.suffix : "";
      if (!prefix.trim() && !suffix.trim()) return all;
      return keep((p) => `${prefix}${p.title}${suffix}`.replace(/\s+/g, " ").trim().slice(0, 300) !== p.title);
    }
    case "addVariation": {
      const value = typeof body.variationValue === "string" ? body.variationValue.trim().slice(0, 100) : "";
      if (!value) return all;
      const vars = await prisma.productVariation.findMany({ where: { productId: { in: selected } }, select: { productId: true, variationValue: true } });
      return { targets: planAddVariation(selected, vars, value).targets, markFirst: [] };
    }
    case "category": {
      const category = typeof body.category === "string" ? body.category.trim().slice(0, 80) : "";
      if (!category) return all;
      return { targets: planCategory(selected, rows, category).targets, markFirst: [] };
    }
    case "discount": {
      const mode = body.mode === "FIXED" ? "FIXED" : body.mode === "PERCENT" ? "PERCENT" : null;
      const value = Number(body.value);
      if (!mode || !Number.isFinite(value) || value <= 0 || (mode === "PERCENT" && value >= 100)) return all;
      return keep((p) => {
        const original = p.listPrice && p.listPrice > p.basePrice ? p.listPrice : p.basePrice;
        const next = round2(Math.max(0, mode === "PERCENT" ? original * (1 - value / 100) : original - value));
        // Aynı indirim zaten uygulanmışsa (fiyat ve eski fiyat aynı) veya indirim fiyatı düşürmüyorsa atlanır
        return next < original && !(p.basePrice === next && p.listPrice === original);
      });
    }
    case "tier": {
      const minQty = Math.floor(Number(body.minQty));
      const value = Number(body.value);
      const type = body.type === "FIXED" ? "FIXED" : body.type === "PERCENT" ? "PERCENT" : null;
      if (!type || !(minQty >= 2) || !(value > 0) || (type === "PERCENT" && value >= 100)) return all;
      return keep((p) => !bulkTiersOf(p.bulkTiers).some((t) => t.minQty === minQty && t.type === type && t.value === value));
    }
    case "removeDiscount": {
      const scope = body.scope === "normal" || body.scope === "tier" ? body.scope : "all";
      const tierQty = Math.floor(Number(body.minQty));
      if (scope === "tier" && !(tierQty >= 2)) return all;
      const hasNormal = (p: Row) => Boolean(p.listPrice && p.listPrice > p.basePrice);
      return keep((p) =>
        scope === "normal" ? hasNormal(p) : scope === "tier" ? bulkTiersOf(p.bulkTiers).some((t) => t.minQty === tierQty) : hasNormal(p) || bulkTiersOf(p.bulkTiers).length > 0 || p.bulkMinQty !== null
      );
    }
    case "specialDiscount": {
      const pctOf = (v: unknown): number | null | undefined => {
        if (v === null || v === "" || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
      };
      const pickupPct = pctOf(body.pickupPct);
      const transferPct = pctOf(body.transferPct);
      if (pickupPct === undefined || transferPct === undefined) return all;
      const want = body.reset === true ? { couponAllowed: true, pickup: null, transfer: null } : { couponAllowed: body.couponAllowed !== false, pickup: pickupPct, transfer: transferPct };
      return keep((p) => p.couponAllowed !== want.couponAllowed || p.pickupDiscountPct !== want.pickup || p.transferDiscountPct !== want.transfer);
    }
    case "showcase": {
      if (typeof body.value !== "boolean") return all;
      if (body.field === "isBestSeller") {
        const displayed = new Set((await getBestSellers(48)).map((p) => p.id));
        return { targets: planBestSeller(body.value, rows, displayed).targets, markFirst: [] };
      }
      if (body.field !== "isFeatured") return all;
      const activeFlagged = await prisma.product.count({ where: { active: true, isFeatured: true } });
      const autoSet = new Set((await prisma.product.findMany({ where: { active: true, ...FEATURED }, select: { id: true } })).map((p) => p.id));
      const plan = planFeatured(body.value, rows, activeFlagged, autoSet);
      return { targets: plan.targets, markFirst: plan.markFirst, info: { auto: plan.mode === "auto", before: plan.before, after: plan.after, revertsToAuto: plan.revertsToAuto } };
    }
    default:
      return all;
  }
}

// Seçili ürünlerde toplu işlem: stok, isim, renk ekleme, koleksiyon (proxy yalnızca yöneticiye açar)
async function POSTHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  // "Tüm ürünler" yalnızca özel indirim kurallarında desteklenir
  const allProducts = body.all === true && body.action === "specialDiscount";
  const selected: string[] = allProducts
    ? (await prisma.product.findMany({ select: { id: true }, take: 2000 })).map((p) => p.id)
    : Array.isArray(body.ids)
      ? [...new Set<string>(body.ids.filter((i: unknown): i is string => typeof i === "string"))].slice(0, 500)
      : [];
  if (selected.length === 0) return NextResponse.json({ error: "Ürün seçilmedi." }, { status: 400 });

  // "Zaten bu durumda" kontrolü (sunucu asıl güvenilir olandır)
  const plan = await planBulk(body, selected);
  const ids = plan.targets;
  const skipped = selected.length - ids.length;
  // Vitrine/indirime giren ama PASİF olan ürünler sitede (getProducts: active=true) görünmez; işlem engellenmez, yalnızca uyarılır
  const exposes = body.action === "discount" || body.action === "tier" || (body.action === "showcase" && body.value === true);
  const hidden = exposes && ids.length ? await prisma.product.count({ where: { id: { in: ids }, active: false } }) : 0;
  if (body.dryRun === true) return NextResponse.json({ dryRun: true, selected: selected.length, apply: ids.length, skipped, hidden, showcase: plan.info ?? null });
  if (ids.length === 0) return NextResponse.json({ success: true, updated: ids.length, skipped });

  // Geri Al için işlem öncesi durum: yalnızca gerçekten değişecek ürünler (otomatik işaretlenenler dahil)
  const before = await snapshotProducts([...new Set([...ids, ...plan.markFirst])]);
  const extra: UndoExtra = {};
  const done = () => buildUndoToken(before, extra);

  switch (body.action) {
    case "stock": {
      const value = Math.floor(Number(body.value));
      if (!Number.isFinite(value)) return NextResponse.json({ error: "Geçerli bir sayı giriniz." }, { status: 400 });
      if (body.mode === "set") {
        if (value < 0) return NextResponse.json({ error: "Stok negatif olamaz." }, { status: 400 });
        await prisma.productVariation.updateMany({ where: { productId: { in: ids } }, data: { stock: value } });
        return NextResponse.json({ snapshot: await done(), success: true, updated: ids.length, skipped });
      }
      // Artırma/azaltma: 0'ın altına inmez
      await prisma.$executeRaw`UPDATE "ProductVariation" SET "stock" = GREATEST(0, "stock" + ${value}) WHERE "productId" = ANY(${ids})`;
      return NextResponse.json({ snapshot: await done(), success: true, updated: ids.length, skipped });
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
      return NextResponse.json({ snapshot: await done(), success: true, updated: ids.length, skipped });
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
      await prisma.productVariation.createMany({
        data: targets.map((productId) => ({ productId, variationType: "Renk", variationValue: value, stock, extraPrice })),
      });
      const created = await prisma.productVariation.findMany({ where: { productId: { in: targets }, variationType: "Renk", variationValue: value }, select: { id: true } });
      extra.deleteVariationIds = created.map((v) => v.id);
      return NextResponse.json({ snapshot: await done(), success: true, updated: ids.length, skipped });
    }

    case "category": {
      const category = typeof body.category === "string" ? body.category.trim().slice(0, 80) : "";
      if (!category) return NextResponse.json({ error: "Koleksiyon adı zorunludur." }, { status: 400 });
      await prisma.product.updateMany({ where: { id: { in: ids } }, data: { category } });
      return NextResponse.json({ snapshot: await done(), success: true, updated: ids.length, skipped });
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
      return NextResponse.json({ snapshot: await done(), success: true, updated: ids.length, skipped });
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
      return NextResponse.json({ snapshot: await done(), success: true, updated: ids.length, skipped });
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
      return NextResponse.json({ snapshot: await done(), success: true, updated: ids.length, skipped });
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
      await prisma.product.updateMany({ where: { id: { in: ids } }, data });
      return NextResponse.json({ snapshot: await done(), success: true, updated: ids.length, skipped });
    }

    // Vitrin: Öne Çıkanlar / Çok Satanlar ekle-çıkar
    case "showcase": {
      const field = body.field === "isFeatured" || body.field === "isBestSeller" ? body.field : null;
      if (!field || typeof body.value !== "boolean") return NextResponse.json({ error: "Geçersiz vitrin işlemi." }, { status: 400 });
      // Otomatik moddaki Öne Çıkanlar kümesi önce elle işaretlenir (liste sayısı korunur); hepsi tek işlemde
      await prisma.$transaction([
        ...(field === "isFeatured" && plan.markFirst.length ? [prisma.product.updateMany({ where: { id: { in: plan.markFirst } }, data: { isFeatured: true } })] : []),
        prisma.product.updateMany({ where: { id: { in: ids } }, data: { [field]: body.value } }),
      ]);
      return NextResponse.json({ snapshot: await done(), success: true, updated: ids.length, skipped });
    }

    default:
      return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  }
}

export const POST = withStorefrontRevalidate(POSTHandler);

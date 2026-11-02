import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";

// Seçili ürünlerde toplu işlem: stok, isim, renk ekleme, koleksiyon (proxy yalnızca yöneticiye açar)
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids)
    ? [...new Set<string>(body.ids.filter((i: unknown): i is string => typeof i === "string"))].slice(0, 500)
    : [];
  if (ids.length === 0) return NextResponse.json({ error: "Ürün seçilmedi." }, { status: 400 });

  switch (body.action) {
    case "stock": {
      const value = Math.floor(Number(body.value));
      if (!Number.isFinite(value)) return NextResponse.json({ error: "Geçerli bir sayı giriniz." }, { status: 400 });
      if (body.mode === "set") {
        if (value < 0) return NextResponse.json({ error: "Stok negatif olamaz." }, { status: 400 });
        const res = await prisma.productVariation.updateMany({ where: { productId: { in: ids } }, data: { stock: value } });
        return NextResponse.json({ success: true, updated: res.count });
      }
      // Artırma/azaltma: 0'ın altına inmez
      const res = await prisma.$executeRaw`UPDATE "ProductVariation" SET "stock" = GREATEST(0, "stock" + ${value}) WHERE "productId" = ANY(${ids})`;
      return NextResponse.json({ success: true, updated: res });
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
      return NextResponse.json({ success: true, updated: products.length });
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
      return NextResponse.json({ success: true, updated: res.count, skipped: ids.length - targets.length });
    }

    case "category": {
      const category = typeof body.category === "string" ? body.category.trim().slice(0, 80) : "";
      if (!category) return NextResponse.json({ error: "Koleksiyon adı zorunludur." }, { status: 400 });
      const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { category } });
      return NextResponse.json({ success: true, updated: res.count });
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
      return NextResponse.json({ success: true, updated: ops.length, skipped: products.length - ops.length });
    }

    // İndirimi kaldır: eski fiyat geri yüklenir, üstü çizili fiyat ve adet indirimi temizlenir
    case "removeDiscount": {
      const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, basePrice: true, listPrice: true } });
      await prisma.$transaction(
        products.map((p) =>
          prisma.product.update({
            where: { id: p.id },
            data: {
              basePrice: p.listPrice && p.listPrice > p.basePrice ? p.listPrice : p.basePrice,
              listPrice: null,
              bulkMinQty: null,
              bulkDiscountType: null,
              bulkDiscountValue: null,
            },
          })
        )
      );
      return NextResponse.json({ success: true, updated: products.length });
    }

    case "bulkQty": {
      const minQty = Math.floor(Number(body.minQty));
      const value = Number(body.value);
      const type = body.type === "FIXED" ? "FIXED" : body.type === "PERCENT" ? "PERCENT" : null;
      if (!type || !(minQty >= 2) || !(value > 0)) return NextResponse.json({ error: "En az 2 adet ve geçerli bir indirim değeri giriniz." }, { status: 400 });
      if (type === "PERCENT" && value >= 100) return NextResponse.json({ error: "Yüzde 100'ün altında olmalıdır." }, { status: 400 });
      const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { bulkMinQty: minQty, bulkDiscountType: type, bulkDiscountValue: value } });
      return NextResponse.json({ success: true, updated: res.count });
    }

    case "removeBulkQty": {
      const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { bulkMinQty: null, bulkDiscountType: null, bulkDiscountValue: null } });
      return NextResponse.json({ success: true, updated: res.count });
    }

    // Vitrin: Öne Çıkanlar / Çok Satanlar ekle-çıkar
    case "showcase": {
      const field = body.field === "isFeatured" || body.field === "isBestSeller" ? body.field : null;
      if (!field || typeof body.value !== "boolean") return NextResponse.json({ error: "Geçersiz vitrin işlemi." }, { status: 400 });
      const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { [field]: body.value } });
      return NextResponse.json({ success: true, updated: res.count });
    }

    default:
      return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  }
}

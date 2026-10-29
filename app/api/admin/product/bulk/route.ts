import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Seçili ürünlerde toplu işlem: stok, isim, renk ekleme, koleksiyon (proxy yalnızca yöneticiye açar)
export async function POST(req: Request) {
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

    default:
      return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  }
}

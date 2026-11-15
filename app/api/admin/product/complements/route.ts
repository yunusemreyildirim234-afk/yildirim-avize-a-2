import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { STOREFRONT_UNCHANGED } from "@/lib/revalidate-rule";
import { isPurchasablePrice } from "@/lib/purchasable";
import { MAX_COMPLEMENTS_PER_MAIN, fixedDiscountFits, validateComplementDiscount } from "@/lib/complements";

const MAX_MAINS = 500;
const MAX_COMPLEMENT_IDS = MAX_COMPLEMENTS_PER_MAIN;

const strList = (v: unknown): string[] | null => {
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !x)) return null;
  return [...new Set(v as string[])];
};
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

interface Skipped {
  mainId: string;
  complementId: string;
  reason: string;
}

// Seçili ürünlerin mevcut bağları + tüm ana/tamamlayıcı ürün kimlikleri (iletişim kutusu zincir kuralını önceden uygular).
async function GETHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const raw = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
  if (ids.length > MAX_MAINS) return bad(`En fazla ${MAX_MAINS} ürün seçilebilir.`);
  const [rows, all] = await Promise.all([
    ids.length
      ? prisma.productComplement.findMany({
          where: { mainProductId: { in: ids } },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: { id: true, mainProductId: true, complementProductId: true, discountType: true, discountValue: true, position: true },
        })
      : Promise.resolve([]),
    prisma.productComplement.findMany({ select: { mainProductId: true, complementProductId: true } }),
  ]);
  return NextResponse.json({
    links: rows,
    mainIds: [...new Set(all.map((l) => l.mainProductId))],
    complementIds: [...new Set(all.map((l) => l.complementProductId))],
  }, STOREFRONT_UNCHANGED);
}

async function POSTHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("Geçersiz istek.");

  if (body.action === "remove") {
    const pairs = Array.isArray(body.pairs) ? body.pairs : null;
    let where: { OR: { mainProductId: string; complementProductId: string }[] } | { mainProductId: { in: string[] }; complementProductId: { in: string[] } };
    if (pairs) {
      if (pairs.length === 0 || pairs.length > MAX_MAINS) return bad("Kaldırılacak bağ sayısı geçersiz.");
      if (pairs.some((p: unknown) => !p || typeof (p as { mainId?: unknown }).mainId !== "string" || typeof (p as { complementId?: unknown }).complementId !== "string")) return bad("Geçersiz bağ.");
      where = { OR: pairs.map((p: { mainId: string; complementId: string }) => ({ mainProductId: p.mainId, complementProductId: p.complementId })) };
    } else {
      const ids = strList(body.ids);
      const compIds = strList(body.complementIds);
      if (!ids || !compIds || ids.length === 0 || compIds.length === 0) return bad("Ürün seçilmedi.");
      if (ids.length > MAX_MAINS || compIds.length > MAX_COMPLEMENT_IDS) return bad("Çok fazla ürün seçildi.");
      where = { mainProductId: { in: ids }, complementProductId: { in: compIds } };
    }
    const res = await prisma.productComplement.deleteMany({ where });
    return NextResponse.json({ success: true, removed: res.count });
  }

  if (body.action !== "add") return bad("Geçersiz işlem.");

  const ids = strList(body.ids);
  const compIds = strList(body.complementIds);
  if (!ids || ids.length === 0) return bad("Ana ürün seçilmedi.");
  if (!compIds || compIds.length === 0) return bad("Tamamlayıcı ürün seçilmedi.");
  if (ids.length > MAX_MAINS) return bad(`En fazla ${MAX_MAINS} ana ürün seçilebilir.`);
  if (compIds.length > MAX_COMPLEMENT_IDS) return bad(`En fazla ${MAX_COMPLEMENT_IDS} tamamlayıcı ürün seçilebilir.`);
  const type = body.type as "PERCENT" | "FIXED";
  const value = body.value as number;
  const invalid = validateComplementDiscount(type, value);
  if (invalid) return bad(invalid);
  const dryRun = body.dryRun === true;

  const involved = [...new Set([...ids, ...compIds])];
  const [products, existing] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: involved } }, select: { id: true, title: true, active: true, basePrice: true, variations: { select: { extraPrice: true } } } }),
    prisma.productComplement.findMany({
      where: { OR: [{ mainProductId: { in: involved } }, { complementProductId: { in: involved } }] },
      select: { mainProductId: true, complementProductId: true, position: true },
    }),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const lowest = (id: string) => {
    const p = byId.get(id);
    if (!p) return NaN;
    const prices = p.variations.map((v) => p.basePrice + (v.extraPrice ?? 0));
    return prices.length ? Math.min(...prices) : p.basePrice;
  };
  const title = (id: string) => byId.get(id)?.title ?? id;

  const existingKeys = new Set(existing.map((l) => `${l.mainProductId}|${l.complementProductId}`));
  const isComplementElsewhere = new Set(existing.map((l) => l.complementProductId));
  const isMainElsewhere = new Set(existing.map((l) => l.mainProductId));
  const idSet = new Set(ids);
  const compSet = new Set(compIds);
  const countByMain = new Map<string, number>();
  const maxPos = new Map<string, number>();
  for (const l of existing) {
    countByMain.set(l.mainProductId, (countByMain.get(l.mainProductId) ?? 0) + 1);
    maxPos.set(l.mainProductId, Math.max(maxPos.get(l.mainProductId) ?? -1, l.position));
  }

  const skipped: Skipped[] = [];
  const warnings: string[] = [];
  const toCreate: { mainProductId: string; complementProductId: string; discountType: string; discountValue: number; position: number }[] = [];
  const toUpdate = new Map<string, string[]>(); // tamamlayıcı → ana ürünler

  for (const c of compIds) {
    if (!byId.has(c)) {
      for (const m of ids) skipped.push({ mainId: m, complementId: c, reason: "Tamamlayıcı ürün bulunamadı." });
      continue;
    }
    if (!isPurchasablePrice(lowest(c))) {
      for (const m of ids) skipped.push({ mainId: m, complementId: c, reason: `«${title(c)}» geçerli bir fiyata sahip değil.` });
      continue;
    }
    if (type === "FIXED" && !fixedDiscountFits(value, lowest(c))) {
      for (const m of ids) skipped.push({ mainId: m, complementId: c, reason: `İndirim, ürünün fiyatını aşamaz: «${title(c)}» (en düşük fiyat ${lowest(c)} ₺).` });
      continue;
    }
    if (!byId.get(c)!.active) warnings.push(`«${title(c)}» pasif; pasifken öneri olarak görünmez.`);
    for (const m of ids) {
      if (!byId.has(m)) {
        skipped.push({ mainId: m, complementId: c, reason: "Ana ürün bulunamadı." });
        continue;
      }
      if (m === c) {
        skipped.push({ mainId: m, complementId: c, reason: "Bir ürün kendisinin tamamlayıcısı olamaz." });
        continue;
      }
      // Zincir/döngü: bir ürün aynı anda hem ana hem tamamlayıcı olamaz (veritabanında ve bu istekte).
      if (isComplementElsewhere.has(m) || compSet.has(m) || isMainElsewhere.has(c) || idSet.has(c)) {
        skipped.push({ mainId: m, complementId: c, reason: "Zincir/döngü: bir ürün hem ana hem tamamlayıcı olamaz." });
        continue;
      }
      if (existingKeys.has(`${m}|${c}`)) {
        toUpdate.set(c, [...(toUpdate.get(c) ?? []), m]);
        continue;
      }
      const n = countByMain.get(m) ?? 0;
      if (n >= MAX_COMPLEMENTS_PER_MAIN) {
        skipped.push({ mainId: m, complementId: c, reason: `Ana ürüne en fazla ${MAX_COMPLEMENTS_PER_MAIN} tamamlayıcı bağlanabilir.` });
        continue;
      }
      countByMain.set(m, n + 1);
      const pos = (maxPos.get(m) ?? -1) + 1;
      maxPos.set(m, pos);
      toCreate.push({ mainProductId: m, complementProductId: c, discountType: type, discountValue: value, position: pos });
    }
  }

  const updated = [...toUpdate.values()].reduce((s, a) => s + a.length, 0);
  const summary = {
    mains: ids.length,
    complements: compIds.length,
    created: toCreate.length,
    updated,
    skipped: skipped.length,
    skippedItems: skipped.slice(0, 50),
    warnings: [...new Set(warnings)],
  };
  if (dryRun) return NextResponse.json({ success: true, dryRun: true, ...summary }, STOREFRONT_UNCHANGED);

  if (toCreate.length || updated) {
    await prisma.$transaction([
      ...(toCreate.length ? [prisma.productComplement.createMany({ data: toCreate, skipDuplicates: true })] : []),
      ...[...toUpdate.entries()].map(([c, mains]) =>
        prisma.productComplement.updateMany({ where: { complementProductId: c, mainProductId: { in: mains } }, data: { discountType: type, discountValue: value } }),
      ),
    ]);
  }
  return NextResponse.json({ success: true, dryRun: false, ...summary }, toCreate.length || updated ? undefined : STOREFRONT_UNCHANGED);
}

export const GET = withStorefrontRevalidate(GETHandler);
export const POST = withStorefrontRevalidate(POSTHandler);

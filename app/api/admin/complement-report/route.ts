import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { dateWhere } from "@/lib/admin-order-query";
import { resolveDateRange } from "@/lib/admin-order-search";
import { COMPLEMENT_REPORT_LIMIT, buildComplementReport } from "@/lib/complement-report";

// Tamamlayıcı satış raporu: sayfa yüklenirken değil, bölüm açılınca istenir. Tarih, sipariş OLUŞTURULMA tarihidir.
export async function GET(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-complement-report", 30, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);

  const sp = new URL(req.url).searchParams;
  const range = resolveDateRange(sp.get("tarih") ?? undefined, sp.get("bas") ?? undefined, sp.get("bit") ?? undefined, new Date());
  const dw = dateWhere(range);

  const found = await prisma.orderItem.findMany({
    where: { bundleMainProductId: { not: null }, ...(dw ? { order: dw } : {}) },
    select: {
      quantity: true,
      unitPrice: true,
      bundleMainProductId: true,
      bundleDiscount: true,
      orderId: true,
      variation: { select: { productId: true } },
      order: { select: { status: true, createdAt: true } },
    },
    orderBy: { order: { createdAt: "desc" } },
    take: COMPLEMENT_REPORT_LIMIT + 1,
  });
  const truncated = found.length > COMPLEMENT_REPORT_LIMIT;
  const items = truncated ? found.slice(0, COMPLEMENT_REPORT_LIMIT) : found;

  const report = buildComplementReport(
    items.map((i) => ({
      orderId: i.orderId,
      orderStatus: i.order.status,
      orderCreatedAt: i.order.createdAt,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      bundleMainProductId: i.bundleMainProductId,
      bundleDiscount: i.bundleDiscount,
      complementProductId: i.variation.productId,
    })),
    range && { start: range.start, end: range.end },
  );

  const ids = new Set<string>();
  for (const g of [...report.byMain, ...report.byComplement]) {
    ids.add(g.id);
    for (const it of g.items) {
      ids.add(it.mainId);
      ids.add(it.complementId);
    }
  }
  const products = ids.size ? await prisma.product.findMany({ where: { id: { in: [...ids] } }, select: { id: true, title: true } }) : [];
  const names: Record<string, string> = Object.fromEntries(products.map((p) => [p.id, p.title]));

  return NextResponse.json({ report, names, truncated, limit: COMPLEMENT_REPORT_LIMIT });
}

import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { serverError } from "@/lib/api-error";
import { planStatusChange } from "@/lib/order-undo";
import { restoreStockInTx, type RestoreTx } from "@/lib/stock-restore";

// Seçili siparişleri (ve bağlı kalem, fatura, dekont kayıtlarını) kalıcı siler. Silmeden ÖNCE, aynı işlem içinde: stoğu düşülmüş (stockDeducted)
// siparişlerin ayrılmış stoğu iade edilir (bayrak koşullu, idempotent) ve henüz iade edilmemiş kupon hakkı geri verilir (iptal akışıyla aynı karar: planStatusChange).
async function DELETEHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? [...new Set<string>(body.ids.filter((i: unknown): i is string => typeof i === "string"))].slice(0, 500) : [];
  if (ids.length === 0) return NextResponse.json({ error: "Sipariş seçilmedi." }, { status: 400 });

  // OrderInvoice tablosu veritabanında yoksa (P2021) başarısız SQL ifadesi tüm işlemi bozar; bu yüzden varlığı önce denetlenir
  const invoiceTable = await prisma
    .$queryRaw<{ ok: boolean }[]>`SELECT to_regclass('public."OrderInvoice"') IS NOT NULL AS ok`
    .then((r) => r[0]?.ok ?? true)
    .catch(() => true);

  try {
    const existing = await prisma.order.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, stockDeducted: true, couponCode: true } });
    // İade + bağımlı kayıtların silinmesi (foreign key sırası) TEK işlemde: biri başarısız olursa hiçbiri uygulanmaz
    const deleted = await prisma.$transaction(
      async (tx) => {
        for (const o of existing) {
          const plan = planStatusChange(o.status, "CANCELLED", o.stockDeducted);
          if (plan.restoreStock) await restoreStockInTx(tx as unknown as RestoreTx, o.id);
          if (plan.releaseCoupon && o.couponCode) await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST(0, "usedCount" - 1) WHERE "code" = ${o.couponCode}`;
        }
        await tx.receiptFile.deleteMany({ where: { orderId: { in: ids } } });
        if (invoiceTable) await tx.orderInvoice.deleteMany({ where: { orderId: { in: ids } } });
        await tx.orderItem.deleteMany({ where: { orderId: { in: ids } } });
        return (await tx.order.deleteMany({ where: { id: { in: ids } } })).count;
      },
      { maxWait: 5000, timeout: 20000 },
    );
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    return serverError("admin/orders/delete", error);
  }
}

export const DELETE = withStorefrontRevalidate(DELETEHandler);

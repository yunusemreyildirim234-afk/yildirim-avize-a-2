import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { serverError } from "@/lib/api-error";
import { planStatusChange } from "@/lib/order-undo";
import { restoreStockInTx, type RestoreTx } from "@/lib/stock-restore";
import { DELETE_GUARD_HOURS, isPaymentInFlight } from "@/lib/stock-rules";
import { orderNotificationLink } from "@/lib/order-display";
import { checkDeleteCount } from "@/lib/bulk-delete";

// Seçili siparişleri (ve bağlı kalem, fatura, dekont kayıtlarını, onay sayfasına giden müşteri bildirimlerini) kalıcı siler. Silmeden ÖNCE, aynı işlem içinde: stoğu düşülmüş (stockDeducted)
// siparişlerin ayrılmış stoğu iade edilir (bayrak koşullu, idempotent) ve henüz iade edilmemiş kupon hakkı geri verilir (iptal akışıyla aynı karar: planStatusChange).
async function DELETEHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const distinct: string[] = Array.isArray(body.ids) ? [...new Set<string>(body.ids.filter((i: unknown): i is string => typeof i === "string"))] : [];
  const ids = distinct.slice(0, 500);
  if (ids.length === 0) return NextResponse.json({ error: "Sipariş seçilmedi." }, { status: 400 });

  // OrderInvoice tablosu veritabanında yoksa (P2021) başarısız SQL ifadesi tüm işlemi bozar; bu yüzden varlığı önce denetlenir
  const invoiceTable = await prisma
    .$queryRaw<{ ok: boolean }[]>`SELECT to_regclass('public."OrderInvoice"') IS NOT NULL AS ok`
    .then((r) => r[0]?.ok ?? true)
    .catch(() => true);

  try {
    const existing = await prisma.order.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, stockDeducted: true, couponCode: true, createdAt: true } });
    // Çoklu silmede istemcinin onayladığı sayı, istekteki ve veritabanındaki sayıyla eşleşmeli (liste bu arada değiştiyse hiçbir şey silinmez; 500'ü aşan liste de reddedilir)
    const countError = checkDeleteCount({ requested: distinct.length, expected: body.expectedCount, found: existing.length });
    if (countError) return NextResponse.json({ error: countError }, { status: 409 });
    // Ödeme sayfası açık olabilecek sipariş silinmez: müşteri öderse PayTR bildirimi kayıtsız kalır (para alınır, sipariş yok)
    const inFlight = existing.filter((o) => isPaymentInFlight(o, Date.now()));
    if (inFlight.length > 0) {
      return NextResponse.json(
        { error: `Silinemedi: ${inFlight.map((o) => `#${o.id.slice(0, 8)}`).join(", ")} son ${DELETE_GUARD_HOURS} saat içinde oluşturulmuş ve hâlâ ödeme bekliyor; müşteri ödeme sayfasında olabilir. Önce durumu "İptal" veya "Ödeme başarısız" yapın ya da sürenin dolmasını bekleyin. Hiçbir sipariş silinmedi.` },
        { status: 409 },
      );
    }
    // İade + bağımlı kayıtların silinmesi (foreign key sırası) TEK işlemde: biri başarısız olursa hiçbiri uygulanmaz
    const deleted = await prisma.$transaction(
      async (tx) => {
        for (const o of existing) {
          const plan = planStatusChange(o.status, "CANCELLED", o.stockDeducted);
          if (plan.restoreStock) await restoreStockInTx(tx as unknown as RestoreTx, o.id);
          if (plan.releaseCoupon && o.couponCode) await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST(0, "usedCount" - 1) WHERE "code" = ${o.couponCode}`;
        }
        // Silinen siparişin onay sayfasına giden müşteri bildirimleri de silinir (bağlantı artık 404 verirdi)
        await tx.notification.deleteMany({ where: { link: { in: ids.map(orderNotificationLink) } } });
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

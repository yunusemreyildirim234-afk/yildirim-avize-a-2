import { prisma } from "@/lib/db";
import { sendOrderNotificationEmails } from "@/lib/email";
import { createShipmentForOrder } from "@/lib/kargonomi";
import { notifyAdmins, notifyCustomer } from "@/lib/notifications";

/** Sipariş kalemleri kadar varyasyon stoğunu düşer (0'ın altına inmez); bir sipariş için yalnızca bir kez. */
export async function deductOrderStock(orderId: string) {
  const claimed = await prisma.order.updateMany({ where: { id: orderId, stockDeducted: false }, data: { stockDeducted: true } });
  if (claimed.count === 0) return;
  const items = await prisma.orderItem.findMany({ where: { orderId }, select: { variationId: true, quantity: true } });
  for (const i of items) {
    await prisma.$executeRaw`UPDATE "ProductVariation" SET "stock" = GREATEST(0, "stock" - ${i.quantity}) WHERE "id" = ${i.variationId}`;
  }
}

/** Düşülmüş sipariş stoğunu iade eder (iptal onayında). */
export async function restoreOrderStock(orderId: string) {
  const claimed = await prisma.order.updateMany({ where: { id: orderId, stockDeducted: true }, data: { stockDeducted: false } });
  if (claimed.count === 0) return;
  const items = await prisma.orderItem.findMany({ where: { orderId }, select: { variationId: true, quantity: true } });
  for (const i of items) {
    await prisma.productVariation.update({ where: { id: i.variationId }, data: { stock: { increment: i.quantity } } });
  }
}

/**
 * Ödemesi alınan (veya havale ile onaylanan) siparişi hazırlanıyor durumuna geçirir,
 * kargo gönderisini oluşturur ve e-posta bildirimlerini yollar. Tekrar çağrılırsa tekrar işlem yapmaz.
 */
export async function finalizeOrder(orderId: string) {
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, status: { in: ["AWAITING_PAYMENT", "PENDING_NEW"] } },
    data: { status: "PENDING" },
  });
  if (claimed.count === 0) return;

  await deductOrderStock(orderId);

  let order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { user: true, items: { include: { variation: { include: { product: true } } } } },
  });

  if (order.shippingType === "STANDART_KARGO") {
    try {
      await createShipmentForOrder(order.id);
      order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { user: true, items: { include: { variation: { include: { product: true } } } } },
      });
    } catch (err) {
      // Siparişi engellemez; admin panelinden tek tıkla yeniden denenebilir
      console.warn("Kargonomi gönderisi oluşturulamadı:", (err as Error).message);
    }
  }

  await notifyCustomer(
    { userId: order.userId },
    { title: "Siparişiniz Alındı", message: `#${order.id.slice(0, 8)} numaralı siparişiniz alındı.`, type: "ORDER", link: `/siparis-onay/${order.id}` }
  );
  await notifyAdmins({
    title: `Yeni Sipariş: #${order.id.slice(0, 8)}`,
    message: `${order.user.name} • ${order.totalAmount.toLocaleString("tr-TR")} ₺`,
    type: "ORDER",
    link: "/admin#siparisler",
  });

  await sendOrderNotificationEmails({
    orderId: order.id,
    customerName: order.user.name,
    customerEmail: order.user.email,
    customerPhone: order.phone,
    totalAmount: order.totalAmount,
    shippingType: order.shippingType,
    paymentMethod: order.paymentMethod,
    kargonomiShipmentId: order.kargonomiShipmentId,
    shippingBarcode: order.shippingBarcode,
    items: order.items.map((i) => ({
      title: i.variation.product.title,
      variationName: i.variation.variationValue,
      quantity: i.quantity,
      price: i.unitPrice,
    })),
  });
}

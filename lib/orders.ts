import { prisma } from "@/lib/db";
import { sendOrderNotificationEmails } from "@/lib/email";
import { createShipmentForOrder } from "@/lib/kargonomi";
import { consumeCoupon } from "@/lib/coupons";

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

  // Sipariş kesinleştiğinde kupon kullanım sayısı 1 artar
  const used = await prisma.order.findUnique({ where: { id: orderId }, select: { couponCode: true } });
  if (used?.couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: used.couponCode }, select: { id: true } });
    if (coupon) await consumeCoupon(coupon.id).catch((err) => console.error("Kupon sayacı artırılamadı:", err));
  }

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

  await sendOrderNotificationEmails({
    orderId: order.id,
    customerName: order.user.name,
    customerEmail: order.user.email,
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

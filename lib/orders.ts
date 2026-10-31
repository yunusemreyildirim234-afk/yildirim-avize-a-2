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

type FullOrder = Awaited<ReturnType<typeof loadOrder>>;
const loadOrder = (orderId: string) =>
  prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { user: true, items: { include: { variation: { include: { product: true } } } } },
  });

async function createShipmentIfNeeded(order: FullOrder): Promise<FullOrder> {
  if (order.shippingType !== "STANDART_KARGO") return order;
  try {
    await createShipmentForOrder(order.id);
    return await loadOrder(order.id);
  } catch (err) {
    // Siparişi engellemez; admin panelinden tek tıkla yeniden denenebilir
    console.warn("Kargonomi gönderisi oluşturulamadı:", (err as Error).message);
    return order;
  }
}

async function announceNewOrder(order: FullOrder) {
  await notifyCustomer(
    { userId: order.userId },
    { title: "Siparişiniz Alındı", message: `#${order.id.slice(0, 8)} numaralı siparişiniz alındı.`, type: "ORDER", link: `/siparis-onay/${order.id}` }
  );
  await notifyAdmins({
    title: `Yeni Sipariş: #${order.id.slice(0, 8)}`,
    message: `${order.user.name} • ${order.totalAmount.toLocaleString("tr-TR")} ₺${order.paymentMethod === "BANK_TRANSFER" ? " • Havale (onay bekliyor)" : ""}`,
    type: "ORDER",
    link: "/admin#siparisler",
  });

  await sendOrderNotificationEmails({
    orderId: order.id,
    customerName: order.user.name,
    customerEmail: order.user.email,
    customerPhone: order.phone,
    orderNote: order.orderNote,
    invoiceType: order.invoiceType,
    taxNumber: order.taxNumber,
    taxOffice: order.taxOffice,
    companyTitle: order.companyTitle,
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

/**
 * Kartlı ödemesi alınan siparişi hazırlanıyor durumuna geçirir, stoğu düşer, kargo gönderisini oluşturur ve bildirimleri yollar.
 * Havale siparişleri (PENDING_NEW) için `awaitPayment: true`: durum ödeme onayına kadar PENDING_NEW kalır,
 * stok rezerve edilir, e-posta/bildirimler gider; gönderi ve hazırlanıyor durumu confirmBankPayment ile gelir.
 * Tekrar çağrılırsa tekrar işlem yapmaz.
 */
export async function finalizeOrder(orderId: string, opts: { awaitPayment?: boolean } = {}) {
  if (opts.awaitPayment) {
    const current = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, stockDeducted: true } });
    if (!current || current.status !== "PENDING_NEW" || current.stockDeducted) return;
    await deductOrderStock(orderId);
    await announceNewOrder(await loadOrder(orderId));
    return;
  }

  const claimed = await prisma.order.updateMany({
    where: { id: orderId, status: { in: ["AWAITING_PAYMENT", "PENDING_NEW"] } },
    data: { status: "PENDING" },
  });
  if (claimed.count === 0) return;

  await deductOrderStock(orderId);
  const order = await createShipmentIfNeeded(await loadOrder(orderId));
  await announceNewOrder(order);
}

/** Yönetici havale ödemesini onaylar: PENDING_NEW → PENDING (hazırlanıyor), gönderi oluşturulur, müşteriye bildirim gider. */
export async function confirmBankPayment(orderId: string): Promise<boolean> {
  const claimed = await prisma.order.updateMany({ where: { id: orderId, status: "PENDING_NEW" }, data: { status: "PENDING" } });
  if (claimed.count === 0) return false;
  await deductOrderStock(orderId); // rezerve edilmemişse (eski kayıtlar) düşer; bayrak çift düşümü engeller
  const order = await createShipmentIfNeeded(await loadOrder(orderId));
  await notifyCustomer(
    { userId: order.userId },
    { title: "Ödemeniz onaylandı", message: `#${order.id.slice(0, 8)} siparişinizin havale ödemesi onaylandı, siparişiniz hazırlanıyor.`, type: "ORDER", link: "/giris#siparisler" }
  );
  return true;
}

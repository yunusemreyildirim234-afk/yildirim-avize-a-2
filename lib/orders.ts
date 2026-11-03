import { prisma } from "@/lib/db";
import { sendOrderNotificationEmails, sendStockShortageEmail } from "@/lib/email";
import { mergeByVariation } from "@/lib/stock-rules";
import { createShipmentForOrder } from "@/lib/kargonomi";
import { notifyAdmins, notifyCustomer } from "@/lib/notifications";
import { cleanGuestEmail } from "@/lib/guest-email";
import { restoreStockInTx, type RestoreTx } from "@/lib/stock-restore";

// Havuz küçük (max 3): interaktif işlemler kısa sürede bitmeli veya hata vermeli
const TX_OPTIONS = { maxWait: 5000, timeout: 10000 };

/**
 * Sipariş kalemleri kadar varyasyon stoğunu düşer; bir sipariş için yalnızca bir kez.
 * Bayrak ve tüm düşümler TEK transaction'dadır (biri başarısız olursa hepsi geri alınır).
 * Düşüm koşulludur (stock >= adet). Koşul tutmazsa (ödeme alınmış ama stok yetersiz) sipariş REDDEDİLMEZ:
 * stok 0'a çekilir ve yöneticiye uyarı gider.
 */
export async function deductOrderStock(orderId: string) {
  const shortages: { variationId: string; quantity: number }[] = [];
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({ where: { id: orderId, stockDeducted: false }, data: { stockDeducted: true } });
    if (claimed.count === 0) return;
    const items = await tx.orderItem.findMany({ where: { orderId }, select: { variationId: true, quantity: true } });
    for (const i of mergeByVariation(items)) {
      const n = await tx.$executeRaw`UPDATE "ProductVariation" SET "stock" = "stock" - ${i.quantity} WHERE "id" = ${i.variationId} AND "stock" >= ${i.quantity}`;
      if (n === 0) {
        await tx.$executeRaw`UPDATE "ProductVariation" SET "stock" = 0 WHERE "id" = ${i.variationId}`;
        shortages.push(i);
      }
    }
  }, TX_OPTIONS);
  if (shortages.length > 0) await reportShortage(orderId, shortages).catch((err) => console.error("[stok] uyarı gönderilemedi:", (err as Error).message));
}

/** Ödemesi alınmış siparişte stok yetmediğinde yöneticiye e-posta + panel bildirimi; hata siparişi bozmaz. */
async function reportShortage(orderId: string, shortages: { variationId: string; quantity: number }[]) {
  const vars = await prisma.productVariation.findMany({
    where: { id: { in: shortages.map((s) => s.variationId) } },
    select: { id: true, variationValue: true, product: { select: { title: true } } },
  });
  const rows = shortages.map((s) => {
    const v = vars.find((x) => x.id === s.variationId);
    return { product: v?.product.title ?? s.variationId, color: v?.variationValue ?? "-", quantity: s.quantity };
  });
  console.error(`[stok] YETERSİZ STOK sipariş=${orderId}`, JSON.stringify(rows));
  await notifyAdmins({
    title: `Stok yetersiz: #${orderId.slice(0, 8)}`,
    message: rows.map((r) => `${r.product} (${r.color}) x${r.quantity}`).join("; "),
    type: "ORDER",
    link: "/admin#siparisler",
  });
  await sendStockShortageEmail({ orderId, items: rows });
}

/** Düşülmüş sipariş stoğunu iade eder (iptal onayında). */
export async function restoreOrderStock(orderId: string) {
  // Bayrak ve stok artışları tek transaction'da: biri başarısız olursa ikisi de geri alınır
  await prisma.$transaction(async (tx) => restoreStockInTx(tx as unknown as RestoreTx, orderId), TX_OPTIONS);
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
    message: `${order.user.name} • ${order.totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺${order.paymentMethod === "BANK_TRANSFER" ? " • Havale (onay bekliyor)" : ""}`,
    type: "ORDER",
    link: "/admin#siparisler",
  });

  await sendOrderNotificationEmails({
    orderId: order.id,
    customerName: order.user.name,
    customerEmail: cleanGuestEmail(order.user.email),
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

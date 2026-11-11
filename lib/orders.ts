import { prisma } from "@/lib/db";
import { sendOrderNotificationEmails, sendStockShortageEmail } from "@/lib/email";
import { BANK_ORDER_HOLD_HOURS, mergeByVariation, RESERVATION_RELEASE_MINUTES } from "@/lib/stock-rules";
import { releaseCoupon } from "@/lib/coupons";
import { isOrderId } from "@/lib/previous-order";
import { bankPendingBlocked, planPendingCleanup, type PendingRow } from "@/lib/pending-orders";
import { createShipmentForOrder } from "@/lib/kargonomi";
import { notifyAdmins, notifyCustomer } from "@/lib/notifications";
import { adminOrderHref } from "@/lib/admin-order-detail";
import { cleanGuestEmail } from "@/lib/guest-email";
import { recipientLabel, recipientOf } from "@/lib/recipient";
import { restoreStockInTx, type RestoreTx } from "@/lib/stock-restore";
import { finalizePaidOrder } from "@/lib/order-finalize";
import { revalidateStorefrontSafe } from "@/lib/revalidate";

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
  let stockChanged = false;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({ where: { id: orderId, stockDeducted: false }, data: { stockDeducted: true } });
    if (claimed.count === 0) return;
    stockChanged = true;
    const items = await tx.orderItem.findMany({ where: { orderId }, select: { variationId: true, quantity: true } });
    for (const i of mergeByVariation(items)) {
      const n = await tx.$executeRaw`UPDATE "ProductVariation" SET "stock" = "stock" - ${i.quantity} WHERE "id" = ${i.variationId} AND "stock" >= ${i.quantity}`;
      if (n === 0) {
        await tx.$executeRaw`UPDATE "ProductVariation" SET "stock" = 0 WHERE "id" = ${i.variationId}`;
        shortages.push(i);
      }
    }
  }, TX_OPTIONS);
  if (stockChanged) revalidateStorefrontSafe(); // transaction bittikten sonra, en iyi çaba: vitrin stoğu bayat kalmasın
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
    link: adminOrderHref(orderId),
  });
  await sendStockShortageEmail({ orderId, items: rows });
}

/** Düşülmüş sipariş stoğunu iade eder (iptal onayında). */
export async function restoreOrderStock(orderId: string) {
  // Bayrak ve stok artışları tek transaction'da: biri başarısız olursa ikisi de geri alınır
  await prisma.$transaction(async (tx) => restoreStockInTx(tx as unknown as RestoreTx, orderId), TX_OPTIONS);
  revalidateStorefrontSafe(); // transaction bittikten sonra, en iyi çaba (ödeme başarısız, süresi dolan rezervasyon, cron süpürmesi bu yoldan geçer)
}

/**
 * Ödeme bekleyen KARTLI siparişi kapatır: AWAITING_PAYMENT → PAYMENT_FAILED (koşullu, yalnızca bir çağrı kazanır),
 * ardından ayrılmış stok (bayrak koşullu) ve kupon hakkı iade edilir. Aynı olay tekrar gelirse etkisizdir. Kapatıldıysa true.
 */
export async function failAwaitingCardOrder(orderId: string): Promise<boolean> {
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { couponCode: true } });
  const failed = await prisma.order.updateMany({ where: { id: orderId, status: "AWAITING_PAYMENT", paymentMethod: "CREDIT_CARD" }, data: { status: "PAYMENT_FAILED" } });
  if (failed.count === 0) return false;
  await restoreOrderStock(orderId);
  await releaseCoupon(o?.couponCode).catch((err) => console.error("[siparis] kupon serbest bırakılamadı:", (err as Error).message));
  return true;
}

/**
 * Tutma süresi (RESERVATION_HOLD_MINUTES, lib/stock-rules.ts) dolmuş AWAITING_PAYMENT kartlı rezervasyonları tembel serbest bırakır (cron günde bir çalıştığı için
 * stok okunurken ve sipariş oluşturulurken çağrılır). variationIds verilirse yalnızca o varyasyonları tutanlar. Serbest bırakılan sayısı döner.
 * Her sipariş failAwaitingCardOrder ile kapanır: durum koşullu geçiş + bayrak koşullu iade; tekrar çağrı stoğu ikinci kez artırmaz.
 */
export async function releaseStaleReservations(variationIds?: string[], now: number = Date.now()): Promise<number> {
  if (variationIds && variationIds.length === 0) return 0;
  const stale = await prisma.order.findMany({
    where: {
      status: "AWAITING_PAYMENT",
      paymentMethod: "CREDIT_CARD",
      stockDeducted: true,
      createdAt: { lt: new Date(now - RESERVATION_RELEASE_MINUTES * 60_000) },
      ...(variationIds ? { items: { some: { variationId: { in: variationIds } } } } : {}),
    },
    select: { id: true },
    take: 50,
  });
  let n = 0;
  for (const o of stale) if (await failAwaitingCardOrder(o.id).catch(() => false)) n++;
  return n;
}

export interface PendingSwap {
  blocked: boolean; // aynı telefon/e-posta için bekleyen sınırı dolu: yeni sipariş reddedilmeli
  swapIds: string[]; // yeni siparişin yerine geçeceği (aynı transaction'da kapatılacak) bekleyen siparişler
  heldStock: Map<string, number>; // bu siparişlerin ayırdığı stok (variationId → adet): ön stok kontrolünde müşterinin lehine sayılır
  heldCoupons: (string | null)[]; // bu siparişlerin tuttuğu kupon kodları: kupon limiti doğrulamasında düşülür
}

/**
 * Yeni kartlı sipariş öncesi KARAR (hiçbir şey yazmaz): müşterinin hangi bekleyen kartlı siparişleri yenisiyle değiştirilecek
 * (kural: lib/pending-orders.ts planPendingCleanup; e-posta tek başına yetmez) ve bekleyen sınırı dolu mu?
 * Eski sipariş burada KAPATILMAZ: kapatma, yeni sipariş kaydıyla aynı transaction'da yapılır (lib/order-swap.ts); yeni sipariş
 * reddedilirse eski sipariş ödeme bekler durumda kalır. Yalnızca tutma süresi içindeki bekleyenler taranır.
 */
export async function planPendingSwap(who: { email: string; phone: string; sessionUserId?: string | null; previousOrderId?: unknown }, now: number = Date.now()): Promise<PendingSwap> {
  const rows: PendingRow[] = await prisma.order.findMany({
    where: { status: "AWAITING_PAYMENT", paymentMethod: "CREDIT_CARD", createdAt: { gte: new Date(now - RESERVATION_RELEASE_MINUTES * 60_000) } },
    select: { id: true, phone: true, userId: true, user: { select: { email: true, password: true } } },
    take: 500,
  });
  const plan = planPendingCleanup(rows, { ...who, previousOrderId: isOrderId(who.previousOrderId) ? who.previousOrderId : null });
  const heldStock = new Map<string, number>();
  const heldCoupons: (string | null)[] = [];
  if (plan.swapIds.length > 0) {
    const held = await prisma.order.findMany({
      where: { id: { in: plan.swapIds }, status: "AWAITING_PAYMENT", stockDeducted: true },
      select: { couponCode: true, items: { select: { variationId: true, quantity: true } } },
    });
    for (const o of held) {
      heldCoupons.push(o.couponCode);
      for (const i of o.items) heldStock.set(i.variationId, (heldStock.get(i.variationId) ?? 0) + i.quantity);
    }
  }
  return { blocked: plan.blocked, swapIds: plan.swapIds, heldStock, heldCoupons };
}

/** Aynı e-posta/telefonun bekleyen Havale siparişi sınırda mı? Süresi (BANK_ORDER_HOLD_HOURS) geçenler sayılmaz. */
export async function bankPendingLimitReached(who: { email: string; phone: string }, now: number = Date.now()): Promise<boolean> {
  const rows = await prisma.order.findMany({
    where: { status: "PENDING_NEW", paymentMethod: "BANK_TRANSFER", createdAt: { gte: new Date(now - BANK_ORDER_HOLD_HOURS * 3_600_000) } },
    select: { phone: true, user: { select: { email: true } } },
    take: 500,
  });
  return bankPendingBlocked(rows, who);
}

/**
 * Dekontsuz, ödemesiz Havale siparişini iptal eder. Durum geçişi, stok ve kupon iadesi TEK transaction'dadır;
 * koşullu geçişi yalnızca bir çağrı kazanır, tekrar çağrı veya yönetici onayıyla yarış çift iade üretmez. İptal edildiyse true.
 */
export async function cancelUnpaidBankOrder(orderId: string): Promise<boolean> {
  const cancelled = await prisma.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: orderId }, select: { couponCode: true } });
    const moved = await tx.order.updateMany({ where: { id: orderId, status: "PENDING_NEW", paymentMethod: "BANK_TRANSFER", receiptUrl: null }, data: { status: "CANCELLED" } });
    if (moved.count === 0) return false;
    await restoreStockInTx(tx as unknown as RestoreTx, orderId);
    await releaseCoupon(o?.couponCode, tx);
    return true;
  }, TX_OPTIONS);
  if (cancelled) revalidateStorefrontSafe(); // transaction bittikten sonra, en iyi çaba
  return cancelled;
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
    message: `${recipientLabel(order)} • ${order.totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺${order.paymentMethod === "BANK_TRANSFER" ? " • Havale (onay bekliyor)" : ""}`,
    type: "ORDER",
    link: adminOrderHref(order.id),
  });

  await sendOrderNotificationEmails({
    orderId: order.id,
    customerName: order.user.name, // "Sayın ..." hitabı hesap adıyla kalır
    recipientName: recipientOf(order), // yönetici e-postasında alıcı satırı
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
    couponCode: order.couponCode,
    createdAt: order.createdAt,
    address: order.address,
    buyerCityName: order.buyerCityName,
    buyerStateName: order.buyerStateName,
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
 * stok sipariş işleminde zaten ayrılmıştır, yalnızca e-posta/bildirimler gider; gönderi ve hazırlanıyor durumu confirmBankPayment ile gelir.
 * Kartlı akış tekrar çağrılırsa tekrar işlem yapmaz.
 * Dönüş: sipariş bu çağrıda sahiplenildiyse true. false = durum bu arada değişmiş (iptal/başarısız/silinmiş ya da zaten işlenmiş);
 * çağıran (PayTR callback) güncel durumu yeniden okuyup geç ödeme olarak raporlar.
 */
export async function finalizeOrder(orderId: string, opts: { awaitPayment?: boolean } = {}): Promise<boolean> {
  if (opts.awaitPayment) {
    const order = await loadOrder(orderId);
    if (order.status !== "PENDING_NEW") return false;
    await announceNewOrder(order);
    return true;
  }

  // Gönderi + bildirim + e-posta en iyi çabadır (lib/order-finalize.ts): hata callback'i 500'e düşürüp bu adımları kalıcı olarak atlatmaz
  return finalizePaidOrder({
    claim: async () => (await prisma.order.updateMany({ where: { id: orderId, status: { in: ["AWAITING_PAYMENT", "PENDING_NEW"] } }, data: { status: "PENDING" } })).count > 0,
    deductStock: () => deductOrderStock(orderId),
    announce: async () => announceNewOrder(await createShipmentIfNeeded(await loadOrder(orderId))),
  });
}

/** Yönetici havale ödemesini onaylar: PENDING_NEW → PENDING (hazırlanıyor), gönderi oluşturulur, müşteriye bildirim gider. */
export async function confirmBankPayment(orderId: string): Promise<boolean> {
  return finalizePaidOrder({
    claim: async () => (await prisma.order.updateMany({ where: { id: orderId, status: "PENDING_NEW" }, data: { status: "PENDING" } })).count > 0,
    deductStock: () => deductOrderStock(orderId), // rezerve edilmemişse (eski kayıtlar) düşer; bayrak çift düşümü engeller
    announce: async () => {
      const order = await createShipmentIfNeeded(await loadOrder(orderId));
      await notifyCustomer(
        { userId: order.userId },
        { title: "Ödemeniz onaylandı", message: `#${order.id.slice(0, 8)} siparişinizin havale ödemesi onaylandı, siparişiniz hazırlanıyor.`, type: "ORDER", link: "/giris#siparisler" }
      );
    },
  });
}

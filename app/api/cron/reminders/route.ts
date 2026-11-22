import { cleanGuestEmail } from "@/lib/guest-email";
import { safeCompare } from "@/lib/session";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendAbandonedCartEmail, sendBankOrderCancelledEmail, sendCartReminderEmail, sendReceiptReminderEmail } from "@/lib/email";
import { buildCampaignFooter, hasActiveConsent } from "@/lib/marketing";
import { releaseCoupon } from "@/lib/coupons";
import { cancelUnpaidBankOrder, restoreOrderStock } from "@/lib/orders";
import { restoreStockInTx, type RestoreTx } from "@/lib/stock-restore";
import { notifyAdmins, notifyCustomer } from "@/lib/notifications";
import { adminOrderHref } from "@/lib/admin-order-detail";
import { ABANDONED_CARD_MINUTES, BANK_ORDER_HOLD_HOURS, shouldCancelUnpaidBank, shouldCloseAbandonedCard } from "@/lib/stock-rules";
import { couponValueLabel, loadShowcaseCoupon } from "@/lib/showcase";
import { revalidateStorefrontSafe } from "@/lib/revalidate";
import { runDailyCleanup } from "@/lib/cleanup-rules";
import { purgeExpiredAddressBooks } from "@/lib/address-retention";
import { PAID_ORDER_STATUSES, abandonedCardWhere, shouldSendAbandonedReminder } from "@/lib/abandoned-card";

// Tek çağrıda temizlik + e-posta + iade adımları çalışır; varsayılan süre yetmeyebilir
export const maxDuration = 60;

const HOUR = 60 * 60 * 1000;

// Vercel Cron her çağrıda "Authorization: Bearer $CRON_SECRET" gönderir. CRON_SECRET tanımlı değilse uç nokta kapalıdır.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeCompare(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  // 0) Günlük veri temizliği (süresi geçmiş doğrulama kodları, eski okunmuş bildirimler): kendi try/catch'i var; hata hatırlatma adımlarını durdurmaz, onların hatası da bunu engellemez (en başta çalışır)
  let cleanup: { codes: number; notifications: number; errors: string[] };
  try {
    cleanup = await runDailyCleanup(prisma);
  } catch (err) {
    cleanup = { codes: 0, notifications: 0, errors: [(err as Error).message] };
  }
  if (cleanup.errors.length) console.error("[cron] temizlik:", cleanup.errors.join("; "));

  // 0b) Adres defteri saklama süresi (3 yıl): ayrı try/catch; hata diğer adımları durdurmaz. Günlüğe yalnız silinen adres SAYISI yazılır.
  let addressesPurged = 0;
  try {
    addressesPurged = await purgeExpiredAddressBooks(prisma);
    console.log(`[cron] adres defteri: ${addressesPurged} adres silindi`);
  } catch (err) {
    console.error("[cron] adres defteri:", (err as Error).message);
  }

  const now = Date.now();
  let abandoned = 0;
  let receipts = 0;

  // 1) Terk edilmiş kartlı ödeme denemeleri: bekleyen veya (31 dk sonra tembel kapatılmış) başarısız, 2 saati geçmiş, son 7 gün; sonradan ödenmiş siparişi olan kullanıcıya gitmez
  const candidates = await prisma.order.findMany({
    where: abandonedCardWhere(now),
    select: {
      id: true,
      userId: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
      items: { select: { quantity: true, variation: { select: { product: { select: { title: true } } } } } },
    },
    take: 50,
  });
  const paidLater = candidates.length
    ? await prisma.order.findMany({
        where: { userId: { in: [...new Set(candidates.map((c) => c.userId))] }, status: { in: PAID_ORDER_STATUSES }, createdAt: { gt: new Date(now - 7 * 24 * HOUR) } },
        select: { userId: true, status: true, createdAt: true },
      })
    : [];
  const carts = candidates.filter((c) => shouldSendAbandonedReminder(c, paidLater.filter((p) => p.userId === c.userId)));
  // Vitrin kuponu geçerli değilse (pasif, süresi dolmuş, limit dolu, kişiye/ürüne özel) onaylı kişiye de sade hatırlatma gider
  const showcase = carts.length > 0 ? await loadShowcaseCoupon().catch(() => null) : null;
  for (const o of carts) {
    // Önce işaretle: aynı mail ikinci kez gitmesin
    const claimed = await prisma.order.updateMany({ where: { id: o.id, abandonedEmailSent: false }, data: { abandonedEmailSent: true } });
    if (claimed.count === 0) continue;
    const to = cleanGuestEmail(o.user.email);
    const items = o.items.map((i) => ({ title: i.variation.product.title, quantity: i.quantity }));
    // Ticari ileti onayı kontrolü (hata/tablo yoksa "onay yok" sayılır): onaylıya kampanya, diğerlerine indirimsiz sade hatırlatma
    const footerHtml = showcase && (await hasActiveConsent(to)) ? await buildCampaignFooter(to) : null;
    const ok = await (footerHtml && showcase
      ? sendAbandonedCartEmail({ to, name: o.user.name, orderId: o.id, couponCode: showcase.code, discountLabel: couponValueLabel(showcase), items, footerHtml })
      : sendCartReminderEmail({ to, name: o.user.name, items })
    ).catch(() => false);
    if (ok) abandoned++;
    else await prisma.order.update({ where: { id: o.id }, data: { abandonedEmailSent: false } });
  }

  // 2) Havale dekont hatırlatması: 3 saati geçmiş, dekont yok, otomatik iptal süresi dolmamış (iptal edilecek siparişe hatırlatma gitmez)
  const pending = await prisma.order.findMany({
    where: {
      status: "PENDING_NEW",
      receiptReminderSent: false,
      receiptUrl: null,
      createdAt: { lt: new Date(now - 3 * HOUR), gt: new Date(now - BANK_ORDER_HOLD_HOURS * HOUR) },
    },
    select: { id: true, user: { select: { email: true, name: true } } },
    take: 50,
  });
  for (const o of pending) {
    const claimed = await prisma.order.updateMany({ where: { id: o.id, receiptReminderSent: false }, data: { receiptReminderSent: true } });
    if (claimed.count === 0) continue;
    const ok = await sendReceiptReminderEmail({ to: cleanGuestEmail(o.user.email), name: o.user.name, orderId: o.id }).catch(() => false);
    if (ok) receipts++;
    else await prisma.order.update({ where: { id: o.id }, data: { receiptReminderSent: false } });
  }

  // 3) Terk edilmiş KARTLI ödemeler: token ömrü + pay geçmişse PAYMENT_FAILED, kupon bir kez serbest.
  // Havale/EFT (PENDING_NEW) siparişlerine dokunulmaz. (E-posta adımından sonra çalışır.)
  let closed = 0;
  const stale = await prisma.order.findMany({
    where: { status: "AWAITING_PAYMENT", paymentMethod: "CREDIT_CARD", createdAt: { lt: new Date(now - ABANDONED_CARD_MINUTES * 60_000) } },
    select: { id: true, couponCode: true, status: true, paymentMethod: true, createdAt: true },
    take: 200,
  });
  for (const o of stale) {
    if (!shouldCloseAbandonedCard(o, now)) continue;
    // Durum + stok + kupon tek transaction'da; durum koşullu geçiş: callback ile yarışırsa yalnızca biri kazanır, hata olursa sipariş sonraki cron'da yeniden denenir
    const done = await prisma.$transaction(async (tx) => {
      const failed = await tx.order.updateMany({ where: { id: o.id, status: "AWAITING_PAYMENT" }, data: { status: "PAYMENT_FAILED" } });
      if (failed.count === 0) return false;
      await restoreStockInTx(tx as unknown as RestoreTx, o.id);
      await releaseCoupon(o.couponCode, tx);
      return true;
    }, { maxWait: 5000, timeout: 10000 }).catch((err) => {
      console.error("[cron] terk edilmiş ödeme kapatılamadı (sonraki çalışmada denenir):", (err as Error).message);
      return false;
    });
    if (done) closed++;
  }
  // Süpürme: kartlı PAYMENT_FAILED olup stoğu hâlâ ayrılı kalmış siparişler (iade adımı hata verdiyse) bayrak koşullu iade edilir
  const stuck = await prisma.order.findMany({ where: { status: "PAYMENT_FAILED", paymentMethod: "CREDIT_CARD", stockDeducted: true }, select: { id: true }, take: 200 });
  for (const o of stuck) await restoreOrderStock(o.id).catch((err) => console.error("[cron] stok süpürme hatası:", (err as Error).message));

  // 4) Dekontsuz, ödemesiz Havale siparişleri: süre dolunca iptal; durum + stok + kupon tek işlemde, bildirimler işlem sonrası
  let bankCancelled = 0;
  const unpaid = await prisma.order.findMany({
    where: { status: "PENDING_NEW", paymentMethod: "BANK_TRANSFER", receiptUrl: null, createdAt: { lt: new Date(now - BANK_ORDER_HOLD_HOURS * HOUR) } },
    select: { id: true, userId: true, status: true, paymentMethod: true, receiptUrl: true, createdAt: true, user: { select: { email: true, name: true } } },
    take: 50,
  });
  for (const o of unpaid) {
    if (!shouldCancelUnpaidBank(o, now)) continue;
    const cancelled = await cancelUnpaidBankOrder(o.id).catch((err) => {
      console.error("[cron] havale siparişi iptal edilemedi:", (err as Error).message);
      return false;
    });
    if (!cancelled) continue;
    bankCancelled++;
    const short = o.id.slice(0, 8);
    await notifyAdmins({ title: `Havale siparişi otomatik iptal: #${short}`, message: `${BANK_ORDER_HOLD_HOURS} saat içinde dekont gelmedi; stok ve kupon iade edildi.`, type: "ORDER", link: adminOrderHref(o.id) });
    await notifyCustomer({ userId: o.userId }, { title: "Siparişiniz iptal edildi", message: `#${short} numaralı Havale siparişiniz ${BANK_ORDER_HOLD_HOURS} saat içinde ödeme dekontu gelmediği için iptal edildi.`, type: "ORDER", link: `/siparis-onay/${o.id}` });
    await sendBankOrderCancelledEmail({ to: cleanGuestEmail(o.user.email), name: o.user.name, orderId: o.id, hours: BANK_ORDER_HOLD_HOURS }).catch(() => false);
  }

  // Stok iade edildiyse (terk edilmiş kartlı ödeme, süpürme, havale iptali) vitrin önbelleği hemen sona erer ("storefront" etiketi, expire: 0); en iyi çaba
  if (closed > 0 || bankCancelled > 0 || stuck.length > 0) revalidateStorefrontSafe();

  return NextResponse.json({ success: true, abandoned, receipts, closed, bankCancelled, cleanup, addressesPurged });
}

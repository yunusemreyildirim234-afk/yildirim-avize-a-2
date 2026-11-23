// "Kargoya Verildi" geçişinin ortak çekirdeği: müşteri bildirimi + e-posta (elle ve otomatik yol aynı kodu kullanır),
// otomatik geçiş (Kargonomi "webservice_shipment_started") ve geri-al korumalı yenileme sarmalayıcısı.
import { prisma } from "@/lib/db";
import { notifyCustomer } from "@/lib/notifications";
import { sendShippedEmail } from "@/lib/email";
import { refreshOrderShipment } from "@/lib/kargonomi";
import { cleanGuestEmail } from "@/lib/guest-email";
import { buildShippedNotice, buildShippedNoticeForced } from "@/lib/shipped-notice";

/** Kargonomi panelinde "Teslim Sürecinde" olan durum anahtarı. */
export const KARGONOMI_STARTED = "webservice_shipment_started";

/** Güvenlik anahtarı: yalnız AUTO_SHIP_ENABLED === "1" iken otomatik geçiş çalışır (varsayılan kapalı). */
export const autoShipEnabled = () => process.env.AUTO_SHIP_ENABLED === "1";

type ShipmentOrder = Awaited<ReturnType<typeof refreshOrderShipment>>;
type NoticeOrder = Parameters<typeof buildShippedNotice>[0] & { userId: string };

export interface ShipDeps {
  notify: typeof notifyCustomer;
  email: typeof sendShippedEmail;
  refresh: (orderId: string) => Promise<ShipmentOrder>;
}
const defaultDeps: ShipDeps = { notify: notifyCustomer, email: sendShippedEmail, refresh: refreshOrderShipment };

/**
 * Müşteriye "kargoya verildi" bildirimi + e-posta. `forced`: gerçek takip kodu yoksa barkod/takipsiz metinle de gönderilir.
 * E-posta hatası akışı bozmaz. Çağıran durumu zaten yazmış olmalıdır.
 */
export async function announceShipped(order: NoticeOrder, orderId: string, opts: { forced: boolean; auto: boolean }, deps: Pick<ShipDeps, "notify" | "email"> = defaultDeps) {
  const notice = opts.forced ? buildShippedNoticeForced(order) : buildShippedNotice(order);
  await deps.notify(
    { userId: order.userId },
    {
      title: opts.auto ? "Siparişiniz otomatik olarak kargoya verildi" : "Sipariş durumunuz güncellendi",
      message: notice ? notice.message(orderId) : `#${orderId.slice(0, 8)}: Siparişiniz kargoya verildi.`,
      type: "ORDER",
      link: notice ? notice.link : "/giris#siparisler",
    }
  );
  if (!notice) return;
  try {
    const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true, name: true } });
    if (user) {
      await deps.email({ to: cleanGuestEmail(user.email), name: user.name, orderId, carrier: notice.carrier, trackingNumber: notice.tracking, trackingKind: notice.trackingKind });
    }
  } catch (e) {
    console.warn("Kargo e-postası gönderilemedi:", (e as Error).message);
  }
}

/**
 * Siparişi otomatik SHIPPED yapar. Koşullu atomik güncelleme: yalnız PENDING + standart kargo + gönderisi olan sipariş;
 * count === 1 ise bildirim/e-posta gider, aksi halde hiçbir şey yapılmaz (eşzamanlı çağrılardan yalnız biri kazanır).
 * `refreshed: false` ise takip kodu yoksa önce bir kez Kargonomi'den yenilenir (hata yutulur). Onay kutusu yok: kod yoksa barkod metniyle gönderilir.
 */
export async function markShippedAuto(orderId: string, opts: { refreshed: boolean }, deps: ShipDeps = defaultDeps): Promise<boolean> {
  if (!opts.refreshed) {
    const cur = await prisma.order.findUnique({ where: { id: orderId }, select: { shippingTrackingCode: true } });
    if (cur && !cur.shippingTrackingCode) await deps.refresh(orderId).catch(() => {});
  }
  const moved = await prisma.order.updateMany({
    where: { id: orderId, status: "PENDING", shippingType: "STANDART_KARGO", kargonomiShipmentId: { not: null } },
    data: { status: "SHIPPED" },
  });
  if (moved.count !== 1) return false;
  console.info(`[otomatik-kargoya-verildi] ${orderId.slice(0, 8)}: otomatik kargoya verildi`);
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (order) await announceShipped(order, orderId, { forced: true, auto: true }, deps).catch((e) => console.warn("[otomatik-kargoya-verildi] bildirim hatası:", (e as Error).message));
  return true;
}

/** Geçiş kuralı (saf): yalnız yeni durum started ve kayıtlı önceki durum started DEĞİLSE. "Geri Al" sonrası kayıt started kalır → tekrar tetiklenmez. */
export const isStartedTransition = (previous: string | null | undefined, next: string | null | undefined) => next === KARGONOMI_STARTED && previous !== KARGONOMI_STARTED;

/** Kargonomi'den yeniler (kayıtlı durumu refreshOrderShipment günceller); önceki durum önce okunur, started'a geçişte ve bayrak açıkken otomatik SHIPPED. */
export async function refreshWithAutoShip(orderId: string, deps: ShipDeps = defaultDeps) {
  const prev = (await prisma.order.findUnique({ where: { id: orderId }, select: { kargonomiStatus: true } }))?.kargonomiStatus ?? null;
  const updated = await deps.refresh(orderId);
  if (autoShipEnabled() && isStartedTransition(prev, updated.kargonomiStatus)) {
    if (await markShippedAuto(orderId, { refreshed: true }, deps)) return { order: (await prisma.order.findUnique({ where: { id: orderId } })) ?? updated, autoShipped: true };
  }
  return { order: updated, autoShipped: false };
}

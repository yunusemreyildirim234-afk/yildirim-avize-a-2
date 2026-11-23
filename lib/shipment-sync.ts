import { prisma } from "@/lib/db";
import { autoShipEnabled, refreshWithAutoShip } from "@/lib/mark-shipped";
import { notifyCustomer } from "@/lib/notifications";
import { announceDeliveredEmail, type DeliveredDeps } from "@/lib/mark-delivered";

/** Türkçe karakterleri ve büyük/küçük harfi normalize eder: "Kargo TESLİM Edildi" → "kargo teslim edildi". */
export function normalizeStatus(v: unknown): string {
  return String(v ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DELIVERED = /\b(delivered|teslim edildi|teslim edilmistir)\b/;
const NOT_DELIVERED = /\b(not|un|non)\s?delivered|teslim edilmedi|teslim edilemedi|teslim edilmemis|iade|return|fail|cancel|iptal/;

/** Yalnızca açıkça "teslim edildi" anlamına gelen durumlar true döner; bilinmeyen durumlar false. */
export function isDeliveredStatus(...values: unknown[]): boolean {
  return values.some((v) => {
    const n = normalizeStatus(v);
    return n !== "" && DELIVERED.test(n) && !NOT_DELIVERED.test(n);
  });
}

/**
 * Siparişi atomik ve idempotent olarak DELIVERED yapar: yalnızca SHIPPED ve talebi onaylanmamış sipariş etkilenir.
 * CANCELLED/RETURNED siparişe dokunmaz, DELIVERED'ı geri almaz. Etkilenen satır 1 ise true.
 */
export async function markDelivered(orderId: string, extra: { kargonomiStatus?: string; kargonomiStatusLabel?: string } = {}, emailDeps?: DeliveredDeps): Promise<boolean> {
  const res = await prisma.order.updateMany({
    where: { id: orderId, status: "SHIPPED", OR: [{ cancelReturnStatus: null }, { cancelReturnStatus: { not: "APPROVED" } }] },
    data: { status: "DELIVERED", deliveredAt: new Date(), ...extra },
  });
  if (res.count !== 1) return false;
  // Yalnızca durum ilk kez değiştiğinde (count === 1) müşteri bildirimi gönderilir
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { userId: true } });
  if (order) {
    await notifyCustomer(
      { userId: order.userId },
      { title: "Sipariş durumunuz güncellendi", message: `#${orderId.slice(0, 8)}: Siparişiniz teslim edildi. Bizi tercih ettiğiniz için teşekkürler!`, type: "ORDER", link: "/giris#siparisler" }
    ).catch(() => {});
    // Teslim e-postası yalnız ilk geçişte (count === 1); kurallar ve hata yutma lib/mark-delivered.ts içinde
    await announceDeliveredEmail(orderId, emailDeps);
  }
  return true;
}

export interface SyncResult {
  checked: number;
  delivered: number;
  failed: number;
  /** Kargonomi'de "Teslim Sürecinde"ye geçtiği için otomatik Kargoya Verildi yapılanlar */
  autoShipped?: number;
}

/** Kargodaki (SHIPPED) siparişlerin durumunu Kargonomi'den çeker; teslim edilmiş olanları DELIVERED yapar. En fazla `limit` sipariş. */
export async function syncShippedOrders(limit = 50): Promise<SyncResult> {
  const orders = await prisma.order.findMany({
    // Bayrak açıksa gönderisi açılmış standart kargo siparişleri (PENDING) de taranır; otomatik Kargoya Verildi için
    where: { kargonomiShipmentId: { not: null }, OR: [{ status: "SHIPPED" }, ...(autoShipEnabled() ? [{ status: "PENDING", shippingType: "STANDART_KARGO" }] : [])] },
    orderBy: { updatedAt: "asc" },
    take: Math.min(limit, 50),
    select: { id: true },
  });
  const result: SyncResult = { checked: orders.length, delivered: 0, failed: 0, autoShipped: 0 };
  for (let i = 0; i < orders.length; i += 5) {
    const chunk = orders.slice(i, i + 5);
    const settled = await Promise.allSettled(
      chunk.map(async (o) => {
        const { order: updated, autoShipped } = await refreshWithAutoShip(o.id);
        if (autoShipped) return "shipped" as const;
        if (isDeliveredStatus(updated.kargonomiStatus, updated.kargonomiStatusLabel)) return (await markDelivered(o.id)) ? ("delivered" as const) : false;
        return false;
      })
    );
    for (const s of settled) {
      if (s.status === "fulfilled") {
        if (s.value === "delivered") result.delivered++;
        else if (s.value === "shipped") result.autoShipped = (result.autoShipped ?? 0) + 1;
      } else {
        result.failed++;
        console.error("[shipment-sync] sipariş senkronize edilemedi:", (s.reason as Error)?.message);
      }
    }
  }
  return result;
}

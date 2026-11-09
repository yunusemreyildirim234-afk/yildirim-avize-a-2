// Sipariş durumu değişikliği ve Geri Al için saf karar yardımcıları (veritabanı çağrıları parametredir; test edilebilir).

import { restoreStockInTx, type RestoreTx } from "./stock-restore.ts";

/** Kupon hakkı zaten iade edilmiş durumlar (tekrar iade edilmez). */
export const COUPON_FREE_STATES = ["PAYMENT_FAILED", "CANCELLED", "RETURNED"];

export interface StatusChangePlan {
  restoreStock: boolean; // ayrılmış/düşülmüş stok iade edilir
  releaseCoupon: boolean; // kupon hakkı iade edilir
}

/**
 * Durum geçişinde ne iade edilir? Stok için TEK doğruluk kaynağı Order.stockDeducted bayrağıdır (kartlı sipariş oluşturulurken, havale/ödeme sonrası düşülür).
 * - İptal/iade veya PAYMENT_FAILED'a geçişte bayrak true ise stok iade edilir (kartlı AWAITING_PAYMENT rezervasyonu dahil).
 * - İptal/iade geçişinde kupon, daha önce iade edilmediyse (PAYMENT_FAILED/CANCELLED/RETURNED değilse) iade edilir.
 */
export function planStatusChange(before: string, next: string, stockDeducted: boolean): StatusChangePlan {
  const closing = next === "CANCELLED" || next === "RETURNED";
  return {
    restoreStock: (closing || next === "PAYMENT_FAILED") && stockDeducted,
    releaseCoupon: closing && !COUPON_FREE_STATES.includes(before),
  };
}

export const COUPON_UNDO_WARNING = (code: string) =>
  `Sipariş eski durumuna döndürüldü ancak "${code}" kuponunun hakkı yeniden ayrılamadı (kupon pasif, süresi dolmuş veya kullanım limiti bu arada doldu). Kupon sayacını Kuponlar bölümünden kontrol edin.`;

/**
 * Geri Al sırasında kupon hakkını yeniden ayırır. `reserve` atomik koşullu UPDATE'tir (usedCount < maxUses).
 * Limit dolmuşsa durum geri alınmış kalır, uyarı metni döner. Yalnızca durum geri alma (koşullu güncelleme) kazanıldıktan SONRA çağrılmalıdır; böylece bir kez sayılır.
 */
export async function reserveCouponForUndo(code: string | null | undefined, reserve: (code: string) => Promise<boolean>): Promise<{ reserved: boolean; warning?: string }> {
  if (!code) return { reserved: false };
  return (await reserve(code)) ? { reserved: true } : { reserved: false, warning: COUPON_UNDO_WARNING(code) };
}

export interface StatusChangeTx {
  order: {
    findUnique(args: { where: { id: string }; select: { status: true; stockDeducted: true; couponCode: true } }): Promise<{ status: string; stockDeducted: boolean; couponCode: string | null } | null>;
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  };
  orderItem: RestoreTx["orderItem"];
  productVariation: RestoreTx["productVariation"];
}

export type StatusChangeResult = { outcome: "NOT_FOUND" } | { outcome: "CONFLICT" } | { outcome: "OK"; from: string; plan: StatusChangePlan; couponCode: string | null };

/**
 * Durum + stok + kupon TEK transaction içinde (çağıran tx verir): biri hata verirse hiçbiri uygulanmaz.
 * Koşullu durum güncellemesi ve stockDeducted bayrağı çift tıklamada çift iadeyi engeller.
 */
export async function applyStatusChangeInTx(tx: StatusChangeTx, orderId: string, status: string, releaseCoupon: (code: string | null) => Promise<unknown>): Promise<StatusChangeResult> {
  const before = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, stockDeducted: true, couponCode: true } });
  if (!before) return { outcome: "NOT_FOUND" };
  const moved = await tx.order.updateMany({ where: { id: orderId, status: before.status }, data: { status } });
  if (moved.count === 0) return { outcome: "CONFLICT" };
  const plan = before.status !== status ? planStatusChange(before.status, status, before.stockDeducted) : { restoreStock: false, releaseCoupon: false };
  if (plan.restoreStock) await restoreStockInTx(tx as unknown as RestoreTx, orderId);
  if (plan.releaseCoupon) await releaseCoupon(before.couponCode);
  return { outcome: "OK", from: before.status, plan, couponCode: before.couponCode };
}

export class UndoRefusal extends Error {}

export interface UndoRequest {
  orderId: string;
  from: string;
  to: string;
  restoredStock: boolean;
  coupon: string | null;
}

export interface UndoTx {
  order: { updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }> };
  orderItem: {
    findMany(args: {
      where: { orderId: string };
      orderBy: { variationId: "asc" };
      select: { variationId: true; quantity: true; variation: { select: { variationValue: true; product: { select: { title: true } } } } };
    }): Promise<{ variationId: string; quantity: number; variation: { variationValue: string; product: { title: string } } }[]>;
  };
}

/** Geri Al çekirdeği (tek transaction içinde): durum karşılaştır-ve-ata, stok variationId sırasıyla ve bayrak koşullu düşülür, kupon yeniden sayılır. */
export async function applyUndoInTx(
  tx: UndoTx,
  t: UndoRequest,
  deps: { deduct: (variationId: string, quantity: number) => Promise<boolean>; reserve: (code: string) => Promise<boolean> },
): Promise<{ warning?: string }> {
  const claimed = await tx.order.updateMany({ where: { id: t.orderId, status: t.to }, data: { status: t.from } });
  if (claimed.count === 0) throw new UndoRefusal("Sipariş durumu bu arada değiştirilmiş; geri alınamadı.");
  if (t.restoredStock) {
    const flag = await tx.order.updateMany({ where: { id: t.orderId, stockDeducted: false }, data: { stockDeducted: true } });
    if (flag.count === 1) {
      const items = await tx.orderItem.findMany({
        where: { orderId: t.orderId },
        orderBy: { variationId: "asc" },
        select: { variationId: true, quantity: true, variation: { select: { variationValue: true, product: { select: { title: true } } } } },
      });
      for (const i of items) {
        if (!(await deps.deduct(i.variationId, i.quantity))) throw new UndoRefusal(`Stok yetersiz: "${i.variation.product.title}" / ${i.variation.variationValue} için ${i.quantity} adet stok yok. Geri alınamadı.`);
      }
    }
  }
  return { warning: (await reserveCouponForUndo(t.coupon, deps.reserve)).warning };
}

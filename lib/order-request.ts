// İptal/iade talebinin yönetici kararı: saf çekirdek (veritabanı istemcisi ve kupon iadesi parametredir; test edilebilir).
// Talep kararı + sipariş durumu + stok + kupon TEK transaction içindedir; e-posta/bildirim çağıranda, transaction DIŞINDA gönderilir.

import { applyStatusChangeInTx, statusName, type StatusChangeTx } from "./order-undo.ts";

/** İptal talebi yalnızca sipariş henüz yola çıkmamışken onaylanabilir. */
export const CANCEL_APPROVABLE = ["PENDING_NEW", "PENDING", "READY_FOR_PICKUP"];
/** İade talebi yalnızca teslim edilmiş siparişte onaylanabilir. */
export const RETURN_APPROVABLE = ["DELIVERED"];

/** Karar uygulanamadı: fırlatılır, çağıranın transaction'ı talep kararını da geri alır (talep PENDING kalır). */
export class RequestRefusal extends Error {}

export type DecisionResult = { outcome: "ALREADY_DECIDED" } | { outcome: "OK"; statusChanged: boolean };

export interface RequestDecision {
  orderId: string;
  type: string; // "CANCEL" | "RETURN"
  approve: boolean;
  note: string | null;
}

/**
 * 1) Koşullu sahiplenme: talep hâlâ PENDING ise karar yazılır; çift tıklamada / iki sekmede yalnızca bir istek kazanır (diğeri ALREADY_DECIDED,
 *    ikinci stok/kupon iadesi ve ikinci e-posta olmaz).
 * 2) Onayda sipariş durumu ŞİMDİ yeniden okunur (talep açıldığından beri kargoya verilmiş / teslim edilmiş olabilir):
 *    iptal yalnızca CANCEL_APPROVABLE, iade yalnızca RETURN_APPROVABLE durumunda onaylanır; değilse RequestRefusal.
 *    Sipariş zaten hedef durumdaysa (ör. cron iptal etmiş) yalnızca talep kapanır, ikinci iade yapılmaz.
 * 3) Durum + stok + kupon applyStatusChangeInTx ile (bayrak koşullu stok, durumdan türeyen tek seferlik kupon iadesi).
 */
export async function decideRequestInTx(tx: StatusChangeTx, d: RequestDecision, releaseCoupon: (code: string | null) => Promise<unknown>): Promise<DecisionResult> {
  const claimed = await tx.order.updateMany({
    where: { id: d.orderId, cancelReturnStatus: "PENDING" },
    data: { cancelReturnStatus: d.approve ? "APPROVED" : "REJECTED", cancelReturnNote: d.note },
  });
  if (claimed.count === 0) return { outcome: "ALREADY_DECIDED" };
  if (!d.approve) return { outcome: "OK", statusChanged: false };

  const isCancel = d.type === "CANCEL";
  const target = isCancel ? "CANCELLED" : "RETURNED";
  const current = await tx.order.findUnique({ where: { id: d.orderId }, select: { status: true, stockDeducted: true, couponCode: true } });
  if (!current) throw new RequestRefusal("Sipariş bulunamadı.");
  if (current.status === target) return { outcome: "OK", statusChanged: false };
  if (!(isCancel ? CANCEL_APPROVABLE : RETURN_APPROVABLE).includes(current.status)) {
    throw new RequestRefusal(
      isCancel
        ? `İptal talebi onaylanamaz: sipariş şu an "${statusName(current.status)}" durumunda (iptal yalnızca kargoya verilmeden önce yapılabilir). Talebi reddedebilirsiniz; hiçbir şey değiştirilmedi.`
        : `İade talebi onaylanamaz: sipariş şu an "${statusName(current.status)}" durumunda (iade yalnızca teslim edilmiş siparişte yapılabilir). Talebi reddedebilirsiniz; hiçbir şey değiştirilmedi.`,
    );
  }
  const r = await applyStatusChangeInTx(tx, d.orderId, target, releaseCoupon);
  if (r.outcome !== "OK") throw new RequestRefusal(r.outcome === "FORBIDDEN" ? r.message : "Sipariş durumu bu sırada değişti; sayfayı yenileyip tekrar deneyin.");
  return { outcome: "OK", statusChanged: true };
}

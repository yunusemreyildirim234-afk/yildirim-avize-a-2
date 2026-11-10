// "Geri dön, tekrar dene": müşterinin ödenmemiş kartlı siparişi, YENİ sipariş kaydıyla AYNI transaction içinde kapatılır.
// Saf çekirdek: veritabanı istemcisi (tx) ve kupon iadesi parametredir (test edilebilir).
//
// Neden tek transaction? Eski sipariş, yeni sipariş doğrulanmadan önce kapatılırsa ve yeni istek reddedilirse (stok/kupon hatası)
// müşteri açık duran ödeme sayfasında ödeme yapar: para alınır, sipariş "ödeme başarısız" kalır. Burada eski siparişin kapanması
// yalnızca yeni sipariş başarıyla kaydedilirse kalıcı olur; yeni sipariş hata verirse transaction geri alınır ve eski sipariş
// ödeme bekler durumda, stoğu ve kuponu ayrılı kalır. Eski siparişin tuttuğu stok/kupon aynı transaction'da serbest kaldığı için
// "son ürün" ve "kişi başı tek kullanım" kuponunda da yeniden deneme çalışır.

import { restoreStockInTx, type RestoreTx } from "./stock-restore.ts";

export interface SwapTx {
  order: {
    findUnique(args: { where: { id: string }; select: { couponCode: true } }): Promise<{ couponCode: string | null } | null>;
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  };
  orderItem: RestoreTx["orderItem"];
  productVariation: RestoreTx["productVariation"];
}

/**
 * Ödeme bekleyen KARTLI siparişi kapatır (AWAITING_PAYMENT → PAYMENT_FAILED, koşullu: ödeme bildirimiyle yarışta yalnızca biri kazanır),
 * ayrılmış stoğu (bayrak koşullu) ve kupon hakkını iade eder. Sipariş artık ödeme beklemiyorsa (ödenmiş/kapanmış) dokunmaz, false döner.
 */
export async function closeAwaitingCardInTx(tx: SwapTx, orderId: string, releaseCoupon: (code: string | null) => Promise<unknown>): Promise<boolean> {
  const closed = await tx.order.updateMany({ where: { id: orderId, status: "AWAITING_PAYMENT", paymentMethod: "CREDIT_CARD" }, data: { status: "PAYMENT_FAILED" } });
  if (closed.count === 0) return false;
  const o = await tx.order.findUnique({ where: { id: orderId }, select: { couponCode: true } });
  await restoreStockInTx(tx as unknown as RestoreTx, orderId);
  await releaseCoupon(o?.couponCode ?? null);
  return true;
}

/**
 * Eski sipariş(ler)i kapatır, ardından yeni siparişi oluşturur; ikisi de çağıranın transaction'ındadır.
 * `create` hata fırlatırsa (stok yetersiz, kupon limiti...) hata aynen iletilir ve transaction geri alınır: eski sipariş(ler) değişmemiş olur.
 * Kimlikler sıralı işlenir (sipariş satırı kilitleri hep aynı sırada alınır).
 */
export async function swapAndCreate<T>(tx: SwapTx, swapIds: string[], releaseCoupon: (code: string | null) => Promise<unknown>, create: () => Promise<T>): Promise<T> {
  for (const id of [...swapIds].sort()) await closeAwaitingCardInTx(tx, id, releaseCoupon);
  return create();
}

/** Değiştirilecek (kapatılacak) siparişlerin bu kupondan tuttuğu hak sayısı: yeni sipariş doğrulanırken limit hesabından düşülür. */
export function heldCouponUses(code: string, heldCodes: readonly (string | null | undefined)[] | undefined): number {
  const key = code.trim().toUpperCase();
  return (heldCodes ?? []).filter((c) => typeof c === "string" && c.trim().toUpperCase() === key).length;
}

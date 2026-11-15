// Sipariş durumu değişikliği ve Geri Al için saf karar yardımcıları (veritabanı çağrıları parametredir; test edilebilir).

import { restoreStockInTx, type RestoreTx } from "./stock-restore.ts";

/** Kupon hakkı zaten iade edilmiş durumlar (tekrar iade edilmez). */
export const COUPON_FREE_STATES = ["PAYMENT_FAILED", "CANCELLED", "RETURNED"];

/** Geçerli sipariş durumları (şemada enum yok; durum düz metindir). */
export const ORDER_STATUSES = ["PENDING", "PENDING_NEW", "AWAITING_PAYMENT", "PAYMENT_FAILED", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];

/**
 * Yöneticinin ELLE yapabileceği durum geçişleri (mevcut durum → izinli yeni durumlar). Listede olmayan geçiş reddedilir.
 * Sistem akışları (PayTR bildirimi, cron, havale onayı, kargo, teslim) kendi koşullu geçişlerini kullanır; bu tablo onları kısıtlamaz.
 * - Teslim edilmiş sipariş iptal edilemez, yalnızca iade edilir. Kargodaki sipariş iptal edilemez (hazırlanıyora alınabilir, teslim/iade yapılabilir).
 * - İptal/başarısız sipariş yalnızca PENDING'e yeniden açılabilir (stok koşullu düşülür, kupon yeniden sayılır). İade edilmiş sipariş son durumdur.
 */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  AWAITING_PAYMENT: ["PENDING", "CANCELLED", "PAYMENT_FAILED"],
  PENDING_NEW: ["PENDING", "CANCELLED"],
  PENDING: ["READY_FOR_PICKUP", "SHIPPED", "DELIVERED", "CANCELLED"],
  READY_FOR_PICKUP: ["PENDING", "DELIVERED", "CANCELLED"],
  SHIPPED: ["PENDING", "DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: ["PENDING"],
  RETURNED: [],
  PAYMENT_FAILED: ["PENDING", "CANCELLED"],
};

const STATUS_NAMES: Record<string, string> = {
  PENDING: "Hazırlanıyor",
  PENDING_NEW: "Havale Onayı Bekleniyor",
  AWAITING_PAYMENT: "Ödeme Bekleniyor",
  PAYMENT_FAILED: "Ödeme Başarısız",
  READY_FOR_PICKUP: "Mağazada Teslime Hazır",
  SHIPPED: "Kargoya Verildi",
  DELIVERED: "Teslim Edildi",
  CANCELLED: "İptal Edildi",
  RETURNED: "İade Edildi",
};
export const statusName = (s: string) => STATUS_NAMES[s] ?? s;

export const canTransition = (from: string, to: string) => from === to || (ALLOWED_TRANSITIONS[from] ?? []).includes(to);

/** Geçiş yasaksa yöneticiye gösterilecek neden; serbestse null. Aynı duruma geçiş etkisizdir (serbest). */
export function transitionError(from: string, to: string): string | null {
  if (canTransition(from, to)) return null;
  if (from === "DELIVERED" && to === "CANCELLED") return "Teslim edilmiş sipariş iptal edilemez; yalnızca İade Edildi yapılabilir.";
  if (from === "SHIPPED" && to === "CANCELLED") return "Kargoya verilmiş sipariş iptal edilemez. Kargo geri döndüyse İade Edildi, henüz çıkmadıysa önce Hazırlanıyor yapın.";
  if (from === "RETURNED") return "İade edilmiş sipariş son durumdadır; durumu değiştirilemez.";
  const allowed = (ALLOWED_TRANSITIONS[from] ?? []).map(statusName).join(", ");
  return `"${statusName(from)}" durumundaki sipariş "${statusName(to)}" yapılamaz. İzinli durumlar: ${allowed || "yok"}.`;
}

export interface StatusChangePlan {
  restoreStock: boolean; // ayrılmış/düşülmüş stok iade edilir
  releaseCoupon: boolean; // kupon hakkı iade edilir
  ensureStock: boolean; // yeniden açma: stok düşülmemişse (bayrak false) koşullu düşülür; yetmezse geçiş reddedilir
  reserveCoupon: boolean; // yeniden açma: kapalı durumda iade edilmiş kupon hakkı yeniden sayılır (koşulsuz +1)
}

/** Stoğu koşullu güvenceye alınarak PENDING'e geçilen durumlar. AWAITING_PAYMENT'ta stok ve kupon zaten ayrılıdır: bayrak korur, kupon yeniden sayılmaz. */
const REOPEN_FROM = ["CANCELLED", "PAYMENT_FAILED", "AWAITING_PAYMENT"];

/**
 * Durum geçişinde ne iade edilir? Stok için TEK doğruluk kaynağı Order.stockDeducted bayrağıdır (kartlı sipariş oluşturulurken, havale/ödeme sonrası düşülür).
 * - İptal/iade veya PAYMENT_FAILED'a geçişte bayrak true ise stok iade edilir (kartlı AWAITING_PAYMENT rezervasyonu dahil).
 * - Kupon için tek kural DURUMDUR (şemada ayrı bayrak yok): açık durumlarda kupon hakkı tutulur, kapalı durumlarda (COUPON_FREE_STATES) serbesttir.
 *   Açık → kapalı bir kez iade eder (PAYMENT_FAILED dahil), kapalı → açık bir kez yeniden sayar, kapalı → kapalı hiçbir şey yapmaz.
 *   Her geçiş durum üzerinde karşılaştır-ve-ata olduğundan CANCELLED → PENDING → CANCELLED dengelidir (+1, −1); çift iade olmaz.
 */
export function planStatusChange(before: string, next: string, stockDeducted: boolean): StatusChangePlan {
  const closing = COUPON_FREE_STATES.includes(next);
  const wasClosed = COUPON_FREE_STATES.includes(before);
  const reopening = next === "PENDING" && REOPEN_FROM.includes(before);
  return {
    restoreStock: closing && stockDeducted,
    releaseCoupon: closing && !wasClosed,
    ensureStock: reopening && !stockDeducted,
    reserveCoupon: reopening && wasClosed,
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

export type StatusChangeResult =
  | { outcome: "NOT_FOUND" }
  | { outcome: "CONFLICT" }
  | { outcome: "FORBIDDEN"; from: string; message: string }
  | { outcome: "OK"; from: string; plan: StatusChangePlan; couponCode: string | null };

/** Geçiş başladıktan sonra tamamlanamadı (ör. yeniden açmada stok yetersiz): fırlatılır, çağıranın transaction'ı her şeyi geri alır. */
export class StatusRefusal extends Error {}

/** Yeniden açma bağımlılıkları: `deduct` koşullu atomik UPDATE (stock >= adet), `reserve` kupon sayacını koşulsuz +1 artırır. */
export interface ReopenDeps {
  deduct: (variationId: string, quantity: number) => Promise<boolean>;
  reserve: (code: string) => Promise<unknown>;
}

const NO_PLAN: StatusChangePlan = { restoreStock: false, releaseCoupon: false, ensureStock: false, reserveCoupon: false };

/**
 * Durum + stok + kupon TEK transaction içinde (çağıran tx verir): biri hata verirse hiçbiri uygulanmaz.
 * Koşullu durum güncellemesi ve stockDeducted bayrağı çift tıklamada çift iadeyi engeller.
 * Geçiş tabloda (ALLOWED_TRANSITIONS) yoksa hiçbir şey yazılmaz (FORBIDDEN + neden).
 * Yeniden açmada (→ PENDING) stok bayrak koşullu ve variationId sırasıyla düşülür; bir kalem yetmezse StatusRefusal fırlatılır.
 */
export async function applyStatusChangeInTx(
  tx: StatusChangeTx,
  orderId: string,
  status: string,
  releaseCoupon: (code: string | null) => Promise<unknown>,
  reopen?: ReopenDeps,
): Promise<StatusChangeResult> {
  const before = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, stockDeducted: true, couponCode: true } });
  if (!before) return { outcome: "NOT_FOUND" };
  const refusal = transitionError(before.status, status);
  if (refusal) return { outcome: "FORBIDDEN", from: before.status, message: refusal };
  // Teslim anı yalnız DELIVERED'a ilk geçişte yazılır; DELIVERED → RETURNED'de korunur (iade süresi tarihi kaybolmasın)
  const data = status === "DELIVERED" && before.status !== "DELIVERED" ? { status, deliveredAt: new Date() } : { status };
  const moved = await tx.order.updateMany({ where: { id: orderId, status: before.status }, data });
  if (moved.count === 0) return { outcome: "CONFLICT" };
  const plan = before.status !== status ? planStatusChange(before.status, status, before.stockDeducted) : NO_PLAN;
  if (plan.restoreStock) await restoreStockInTx(tx as unknown as RestoreTx, orderId);
  if (plan.releaseCoupon) await releaseCoupon(before.couponCode);
  if (plan.ensureStock || plan.reserveCoupon) {
    if (!reopen) throw new StatusRefusal("Bu geçiş için stok/kupon işlemi tanımlı değil.");
    if (plan.ensureStock) await deductForReopen(tx as unknown as UndoTx, orderId, reopen.deduct);
    if (plan.reserveCoupon && before.couponCode) await reopen.reserve(before.couponCode);
  }
  return { outcome: "OK", from: before.status, plan, couponCode: before.couponCode };
}

/** Yeniden açılan siparişin stoğunu düşer: bayrak koşullu (zaten düşülmüşse tekrar düşmez), variationId sırasıyla, hepsi ya da hiçbiri. */
async function deductForReopen(tx: UndoTx, orderId: string, deduct: ReopenDeps["deduct"]): Promise<void> {
  const flag = await tx.order.updateMany({ where: { id: orderId, stockDeducted: false }, data: { stockDeducted: true } });
  if (flag.count !== 1) return;
  const items = await tx.orderItem.findMany({
    where: { orderId },
    orderBy: { variationId: "asc" },
    select: { variationId: true, quantity: true, variation: { select: { variationValue: true, product: { select: { title: true } } } } },
  });
  for (const i of items) {
    if (!(await deduct(i.variationId, i.quantity))) {
      throw new StatusRefusal(`Stok yetersiz: "${i.variation.product.title}" / ${i.variation.variationValue} için ${i.quantity} adet stok yok. Sipariş yeniden açılamadı; hiçbir şey değiştirilmedi.`);
    }
  }
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
  // Teslim geri alınıyorsa teslim anı da silinir
  const claimed = await tx.order.updateMany({ where: { id: t.orderId, status: t.to }, data: t.to === "DELIVERED" ? { status: t.from, deliveredAt: null } : { status: t.from } });
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

// Ödemesi alınan siparişi işleme almanın saf çekirdeği: veritabanı ve dış servis çağrıları parametredir (test edilebilir).

import { bestEffort } from "./best-effort.ts";

export interface FinalizeDeps {
  /** Koşullu durum geçişi (ör. AWAITING_PAYMENT → PENDING); yalnızca bir çağrı kazanır. */
  claim: () => Promise<boolean>;
  /** Stok düşümü (bayrak koşullu, idempotent). Hata fırlatırsa çağırana iletilir. */
  deductStock: () => Promise<unknown>;
  /** Kargo gönderisi + bildirim + e-posta: sipariş kaydını ETKİLEMEYEN yan etkiler. */
  announce: () => Promise<unknown>;
  log?: (...a: unknown[]) => void;
}

/**
 * Sahiplenme kaybedildiyse false (hiçbir şey yapılmaz). Kazanıldıysa stok düşülür, ardından yan etkiler EN İYİ ÇABA ile çalışır:
 * Kargonomi/e-posta/bildirim hatası fırlatılmaz. Aksi hâlde PayTR callback'i 500 döner, PayTR yeniden dener, sipariş artık PENDING olduğu için
 * "zararsız yineleme" sayılır ve bu adımlar bir daha hiç çalışmaz; hata loglanır, sipariş panelde görünür.
 */
export async function finalizePaidOrder(deps: FinalizeDeps): Promise<boolean> {
  if (!(await deps.claim())) return false;
  await deps.deductStock();
  await bestEffort("order/finalize", deps.announce, deps.log);
  return true;
}

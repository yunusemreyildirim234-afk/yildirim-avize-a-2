// Kartlı ödeme ekranı açıkken sipariş kimliği sessionStorage'da tutulur; müşteri ekranı kapatıp tekrar denerse sunucuya "previousOrderId" olarak gider.
// Depolama kapalıysa (try/catch) davranış eskisi gibidir (45 dk kuralı).
const KEY = "ya-pending-card-order";

export function rememberCardOrder(orderId: unknown) {
  try {
    if (typeof orderId === "string") sessionStorage.setItem(KEY, orderId);
  } catch {
    /* depolama kapalı */
  }
}

export function previousCardOrderId(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function forgetCardOrder() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* depolama kapalı */
  }
}

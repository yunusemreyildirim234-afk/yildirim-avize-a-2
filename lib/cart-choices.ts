/** Sepet seçimlerini (kupon kodu, ödeme yöntemi) yalnızca bu sekmede, sayfa yenilenince korumak için saf yardımcılar. Kupon geri yüklenince sunucuda yeniden doğrulanır. */

export type PaymentChoice = "CREDIT_CARD" | "BANK_TRANSFER";
export type CartChoices = { coupon: string; paymentMethod: PaymentChoice | null };

export const CART_CHOICES_KEY = "ya-cart-choices";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function parseCartChoices(raw: string | null): CartChoices {
  const empty: CartChoices = { coupon: "", paymentMethod: null };
  if (!raw) return empty;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return empty;
    const o = v as Record<string, unknown>;
    return {
      coupon: typeof o.coupon === "string" ? o.coupon.trim().slice(0, 40) : "",
      paymentMethod: o.paymentMethod === "CREDIT_CARD" || o.paymentMethod === "BANK_TRANSFER" ? o.paymentMethod : null,
    };
  } catch {
    return empty;
  }
}

export function loadCartChoices(store: Store | null): CartChoices {
  try {
    return parseCartChoices(store ? store.getItem(CART_CHOICES_KEY) : null);
  } catch {
    return { coupon: "", paymentMethod: null };
  }
}

export function saveCartChoices(store: Store | null, c: CartChoices): void {
  try {
    store?.setItem(CART_CHOICES_KEY, JSON.stringify(c));
  } catch {
    // depolama kapalı/dolu: sessizce geç
  }
}

export function clearCartChoices(store: Store | null): void {
  try {
    store?.removeItem(CART_CHOICES_KEY);
  } catch {
    // depolama kapalı: sessizce geç
  }
}

/** sessionStorage'a güvenle erişir (kapalıysa null). */
export function tabStore(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

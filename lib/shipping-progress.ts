// Sepet "ücretsiz kargoya ne kadar kaldı" gösterimi (yalnızca görüntü; kargo hesabı lib/cart-pricing.ts içindedir).

export interface ShippingProgress {
  remaining: number; // kalan tutar (₺, kuruşa yuvarlı); eşiğe ulaşıldıysa 0
  percent: number; // 0-100 (tam sayı, aşağı yuvarlı)
  reached: boolean;
  empty: boolean;
}

export function shippingProgress(itemsTotal: number, threshold: number): ShippingProgress {
  const total = Number.isFinite(itemsTotal) && itemsTotal > 0 ? itemsTotal : 0;
  const reached = total >= threshold;
  return {
    remaining: reached ? 0 : Math.round((threshold - total) * 100) / 100,
    percent: reached ? 100 : Math.min(100, Math.floor((total / threshold) * 100)),
    reached,
    empty: total === 0,
  };
}

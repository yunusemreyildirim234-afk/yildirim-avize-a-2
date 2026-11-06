// Favori ürün fiyat düşüşü bildirimi: karar kuralları (saf, birim test edilir). Veritabanı işi lib/price-drop-notify.ts'dedir.

export const PRICE_DROP_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** Tek fiyat değişikliğinde bu sayıdan çok alıcı varsa e-posta atılmaz (yalnızca zil bildirimi). */
export const PRICE_DROP_MAX_EMAILS = 50;

/** Zil bildirimi oluşsun mu? Yalnızca gerçek düşüş (kuruş altı farklar sayılmaz) ve son bildirimden 24 saat geçmişse. */
export function shouldNotifyPriceDrop(oldPrice: number, newPrice: number, lastNoticeAt: Date | null, now: Date = new Date()): boolean {
  if (!Number.isFinite(oldPrice) || !Number.isFinite(newPrice) || newPrice < 0) return false;
  if (!(oldPrice - newPrice >= 0.01)) return false;
  if (lastNoticeAt && now.getTime() - lastNoticeAt.getTime() < PRICE_DROP_COOLDOWN_MS) return false;
  return true;
}

/** E-posta gitsin mi? Zil bildirimi kuralı geçmeli, açık onay olmalı ve toplam alıcı sayısı sınırı aşmamalı. */
export function shouldEmailPriceDrop(o: { notify: boolean; consent: boolean; recipientCount: number }): boolean {
  return o.notify && o.consent && o.recipientCount <= PRICE_DROP_MAX_EMAILS;
}

export const formatTl = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function priceDropMessage(title: string, oldPrice: number, newPrice: number): string {
  return `Favorinizdeki ${title} ürününün fiyatı ${formatTl(oldPrice)} ₺ → ${formatTl(newPrice)} ₺ oldu`;
}

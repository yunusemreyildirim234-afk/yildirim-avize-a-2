/** Trendyol'dan gelen liste bozuk/eksik görünüyorsa eşitleme durdurulur (aksi halde eksik liste "kalkan ürün" sayılıp pasife alma/yanlış plan üretir). Saf: ağ/veritabanı yok. */
export class TrendyolGuardError extends Error {}

/** @param incomingCount Trendyol'dan gelen ürün sayısı @param matchedCount sitede Trendyol'a eşleşmiş (trendyolMainId dolu) ürün sayısı */
export function assertIncomingSane(incomingCount: number, matchedCount: number): void {
  if (incomingCount === 0) {
    throw new TrendyolGuardError("Trendyol'dan ürün listesi boş geldi; eşitleme durduruldu. Birkaç dakika sonra yeniden önizleyin.");
  }
  if (matchedCount > 0 && incomingCount < matchedCount / 2) {
    throw new TrendyolGuardError(
      `Trendyol listesi eksik görünüyor (${incomingCount} ürün geldi, sitede eşleşmiş ${matchedCount} ürün var); eşitleme durduruldu. Birkaç dakika sonra yeniden önizleyin.`,
    );
  }
}

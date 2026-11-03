// Kartlı sipariş stok rezervasyonunun saf çekirdeği: `claim` koşullu atomik UPDATE'tir (stock >= adet) ve başarıyı bildirir.
// Bir kalem yetmezse hata fırlatır; çağıran transaction olduğundan önceki düşümler geri alınır.

export class StockShortError extends Error {
  readonly variationId: string;
  constructor(variationId: string) {
    super("stock-short");
    this.variationId = variationId;
  }
}

export async function reserveLines(lines: { variationId: string; quantity: number }[], claim: (variationId: string, quantity: number) => Promise<boolean>): Promise<void> {
  for (const l of lines) {
    if (!(await claim(l.variationId, l.quantity))) throw new StockShortError(l.variationId);
  }
}

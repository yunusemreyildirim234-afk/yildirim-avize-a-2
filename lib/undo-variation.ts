// Geri Al: varyasyon girdisi için SAF yardımcılar (veritabanı yok; birim test edilebilir).

export const UNDO_VALUE_MAX = 200;

export interface VarState {
  id: string;
  stock: number;
  extraPrice: number;
  variationValue: string;
}
export interface VarUndoEntry {
  id: string;
  stockDelta?: number;
  extraPrice?: number;
  /** Geri alınca dönülecek eski ad */
  variationValue?: string;
}

/** İşlem öncesi (b) ve sonrası (c) durumdan geri alma girdisi; değişiklik yoksa null. */
export function variationUndoEntry(b: VarState, c: VarState): VarUndoEntry | null {
  const entry: VarUndoEntry = { id: b.id };
  if (c.stock !== b.stock) entry.stockDelta = c.stock - b.stock;
  if (c.extraPrice !== b.extraPrice) entry.extraPrice = b.extraPrice;
  if (c.variationValue !== b.variationValue) entry.variationValue = b.variationValue;
  return entry.stockDelta !== undefined || entry.extraPrice !== undefined || entry.variationValue !== undefined ? entry : null;
}

/** İmzalı belirteçten gelen eski ad geçerli mi? (boş olmayan metin, en çok 200 karakter) */
export const isUndoValue = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= UNDO_VALUE_MAX;

// Sepette "birlikte alma indirimi" gösterimi ve kalkma bildirimi (saf; hesap lib/cart-pricing.ts'te, burada yalnız metin/karşılaştırma).

export interface BundleInfo {
  mainProductId: string;
  unitDiscount: number;
  total: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const tl = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Satırda bağ indirimi varsa etiket ve birim fiyatlar; yoksa null. unitPrice = NORMAL (kademe sonrası) birim fiyat; indirim satır başına yalnız 1 adet içindir. */
export function bundleLineView(bundle: BundleInfo | null | undefined, unitPrice: number): { label: string; regularUnit: number; discountedUnit: number; text: string } | null {
  if (!bundle || !(bundle.unitDiscount > 0)) return null;
  const discountedUnit = r2(unitPrice - bundle.unitDiscount);
  return { label: "Birlikte alma indirimi", regularUnit: unitPrice, discountedUnit, text: `Birlikte alma indirimi (1 adet için): ${tl(bundle.total)} ₺ (birim ${tl(unitPrice)} ₺ yerine ${tl(discountedUnit)} ₺)` };
}

/** Sepet satırında gösterilecek birim fiyat: tek adetli bağ satırında indirimli birim, aksi halde normal birim. */
export function shownUnitPrice(p: { unitPrice: number; quantity: number; bundle?: BundleInfo | null }): number {
  return p.bundle && p.quantity <= 1 ? r2(p.unitPrice - p.bundle.unitDiscount) : p.unitPrice;
}

/** "N × birim" ifadesi (toplam hariç): bağ varsa "1 × indirimli + (N−1) × normal". */
export function lineBreakdownExpr(p: { unitPrice: number; quantity: number; bundle?: BundleInfo | null }): string {
  if (p.bundle && p.quantity > 1) return `1 × ${tl(r2(p.unitPrice - p.bundle.unitDiscount))} ₺ + ${p.quantity - 1} × ${tl(p.unitPrice)} ₺`;
  return `${p.quantity} × ${tl(p.unitPrice)} ₺`;
}

/** Önceki tekliften sonraki teklife: indirimi KALKAN (hâlâ sepette olan) satırların başlıkları. Ürün kendisi çıkarsa sayılmaz. */
export function lostBundleTitles(
  prev: { variationId: string; title?: string; bundle?: BundleInfo | null }[] | null | undefined,
  next: { variationId: string; available?: boolean; bundle?: BundleInfo | null }[]
): string[] {
  if (!prev) return [];
  const now = new Map(next.filter((l) => l.available !== false).map((l) => [l.variationId, l]));
  return prev.flatMap((p) => {
    const n = now.get(p.variationId);
    return p.bundle && n && !n.bundle ? [p.title ?? "Ürün"] : [];
  });
}

export const BUNDLE_LOST_NOTE = "Birlikte alma indirimi kalktı: ana ürün sepetten çıktığı için";

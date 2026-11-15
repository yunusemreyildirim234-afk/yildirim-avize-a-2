// Sepette "birlikte alma indirimi" gösterimi ve kalkma bildirimi (saf; hesap lib/cart-pricing.ts'te, burada yalnız metin/karşılaştırma).

export interface BundleInfo {
  mainProductId: string;
  unitDiscount: number;
  total: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const tl = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Satırda bağ indirimi varsa etiket ve indirimsiz birim fiyat; yoksa null (satır eskisi gibi çizilir). */
export function bundleLineView(bundle: BundleInfo | null | undefined, unitPrice: number): { label: string; regularUnit: number; text: string } | null {
  if (!bundle || !(bundle.unitDiscount > 0)) return null;
  const regularUnit = r2(unitPrice + bundle.unitDiscount);
  return { label: "Birlikte alma indirimi", regularUnit, text: `Birlikte alma indirimi: ${tl(bundle.total)} ₺ (birim ${tl(regularUnit)} ₺ yerine ${tl(unitPrice)} ₺)` };
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

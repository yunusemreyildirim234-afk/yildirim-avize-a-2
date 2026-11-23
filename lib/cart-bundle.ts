// Sepette "birlikte alma indirimi" gösterimi ve kalkma bildirimi (saf; hesap lib/cart-pricing.ts'te, burada yalnız metin/karşılaştırma).

export interface BundleInfo {
  mainProductId: string;
  unitDiscount: number;
  qty: number; // bu ana ürün için indirimli adet
  total: number; // unitDiscount × qty
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const tl = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Satırda bağ indirimi varsa etiket ve birim fiyatlar; yoksa null. unitPrice = NORMAL (kademe sonrası) birim fiyat. */
export function bundleLineView(bundles: BundleInfo[] | null | undefined, unitPrice: number): { label: string; regularUnit: number; discountedUnit: number; text: string } | null {
  const gs = (bundles ?? []).filter((g) => g.unitDiscount > 0 && g.qty > 0);
  if (gs.length === 0) return null;
  const qty = gs.reduce((s, g) => s + g.qty, 0);
  const total = r2(gs.reduce((s, g) => s + g.total, 0));
  const discountedUnit = r2(unitPrice - gs[0].unitDiscount);
  const unitNote = gs.length === 1 ? ` (birim ${tl(unitPrice)} ₺ yerine ${tl(discountedUnit)} ₺)` : "";
  return { label: "Birlikte alma indirimi", regularUnit: unitPrice, discountedUnit, text: `Birlikte alma indirimi (${qty} adet için): ${tl(total)} ₺${unitNote}` };
}

/** Sepet satırında gösterilecek birim fiyat: tüm adetler tek indirimli grupta ise indirimli birim, aksi halde normal birim. */
export function shownUnitPrice(p: { unitPrice: number; quantity: number; bundles?: BundleInfo[] | null }): number {
  const g = p.bundles;
  return g && g.length === 1 && g[0].qty >= p.quantity ? r2(p.unitPrice - g[0].unitDiscount) : p.unitPrice;
}

/** "N × birim" ifadesi (toplam hariç): bağ varsa "10 × indirimli + 1 × indirimli + kalan × normal". */
export function lineBreakdownExpr(p: { unitPrice: number; quantity: number; bundles?: BundleInfo[] | null }): string {
  const gs = p.bundles ?? [];
  if (gs.length === 0) return `${p.quantity} × ${tl(p.unitPrice)} ₺`;
  const parts = gs.map((g) => `${g.qty} × ${tl(r2(p.unitPrice - g.unitDiscount))} ₺`);
  const rest = p.quantity - gs.reduce((s, g) => s + g.qty, 0);
  if (rest > 0) parts.push(`${rest} × ${tl(p.unitPrice)} ₺`);
  return parts.join(" + ");
}

/** Önceki tekliften sonraki teklife: indirimi KALKAN (hâlâ sepette olan) satırların başlıkları. Ürün kendisi çıkarsa sayılmaz. */
export function lostBundleTitles(
  prev: { variationId: string; title?: string; bundles?: BundleInfo[] | null }[] | null | undefined,
  next: { variationId: string; available?: boolean; bundles?: BundleInfo[] | null }[]
): string[] {
  if (!prev) return [];
  const now = new Map(next.filter((l) => l.available !== false).map((l) => [l.variationId, l]));
  return prev.flatMap((p) => {
    const n = now.get(p.variationId);
    return p.bundles?.length && n && !n.bundles?.length ? [p.title ?? "Ürün"] : [];
  });
}

export const BUNDLE_LOST_NOTE = "Birlikte alma indirimi kalktı: ana ürün sepetten çıktığı için";

// Sepette "birlikte alma indirimi" gösterimi ve kalkma bildirimi (saf; hesap lib/cart-pricing.ts'te, burada yalnız metin/karşılaştırma).

export interface BundleInfo {
  mainProductId: string;
  unitDiscount: number;
  qty: number; // bu ana ürün için indirimli adet
  total: number; // unitDiscount × qty
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const tl = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** İndirimli parçalar: aynı birim fiyatlı gruplar (farklı ana ürünlerden gelse de) tek parçada toplanır; ilk görülme sırası korunur. */
function discountedParts(bundles: BundleInfo[] | null | undefined, unitPrice: number): { unit: number; qty: number }[] {
  const parts: { unit: number; qty: number }[] = [];
  for (const g of bundles ?? []) {
    if (!(g.unitDiscount > 0 && g.qty > 0)) continue;
    const unit = r2(unitPrice - g.unitDiscount);
    const hit = parts.find((x) => x.unit === unit);
    if (hit) hit.qty += g.qty;
    else parts.push({ unit, qty: g.qty });
  }
  return parts;
}

/** Satırda bağ indirimi varsa etiket ve birim fiyatlar; yoksa null. unitPrice = NORMAL (kademe sonrası) birim fiyat. */
export function bundleLineView(bundles: BundleInfo[] | null | undefined, unitPrice: number): { label: string; regularUnit: number; discountedUnit: number; text: string } | null {
  const parts = discountedParts(bundles, unitPrice);
  if (parts.length === 0) return null;
  const qty = parts.reduce((s, x) => s + x.qty, 0);
  const total = r2((bundles ?? []).filter((g) => g.unitDiscount > 0 && g.qty > 0).reduce((s, g) => s + g.total, 0));
  const discountedUnit = parts[0].unit;
  const unitNote = parts.length === 1 ? ` (birim ${tl(unitPrice)} ₺ yerine ${tl(discountedUnit)} ₺)` : "";
  return { label: "Birlikte alma indirimi", regularUnit: unitPrice, discountedUnit, text: `Birlikte alma indirimi (${qty} adet için): ${tl(total)} ₺${unitNote}` };
}

/** Sepet satırında gösterilecek birim fiyat: tüm adetler aynı indirimli birim fiyatta ise o fiyat, aksi halde normal birim. */
export function shownUnitPrice(p: { unitPrice: number; quantity: number; bundles?: BundleInfo[] | null }): number {
  const parts = discountedParts(p.bundles, p.unitPrice);
  return parts.length === 1 && parts[0].qty >= p.quantity ? parts[0].unit : p.unitPrice;
}

/** "N × birim" ifadesi (toplam hariç): aynı fiyatlı indirimli parçalar birleşir, indirimsiz kalan adet ayrı yazılır. */
export function lineBreakdownExpr(p: { unitPrice: number; quantity: number; bundles?: BundleInfo[] | null }): string {
  const parts = discountedParts(p.bundles, p.unitPrice).map((x) => `${x.qty} × ${tl(x.unit)} ₺`);
  if (parts.length === 0) return `${p.quantity} × ${tl(p.unitPrice)} ₺`;
  const rest = p.quantity - discountedParts(p.bundles, p.unitPrice).reduce((s, x) => s + x.qty, 0);
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

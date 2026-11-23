// Kargonomi gönderi yanıtından kargo ücreti kararı (saf). Order.shippingPrice metin olarak "195.44" biçiminde saklanır (KDV dahil).
// Yanıt biçimi: { status, pricing: { estimated_price, real_price | null, extra_shipping_price (metin) } }.

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? (v.trim() === "" ? NaN : Number(v.trim())) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * Siparişe yazılacak kargo ücreti:
 * - gönderi iptal edilmişse null (ücret silinir),
 * - değilse (real_price, yoksa estimated_price) + extra_shipping_price (çevrilemez/boşsa 0), kuruşa yuvarlı metin,
 * - beklenmedik/eksik değerde undefined: mevcut ücrete DOKUNULMAZ.
 */
export function decideShippingPrice(shipment: unknown): string | null | undefined {
  if (!shipment || typeof shipment !== "object") return undefined;
  const s = shipment as { status?: unknown; pricing?: unknown };
  if (s.status === "cancelled") return null;
  if (!s.pricing || typeof s.pricing !== "object") return undefined;
  const p = s.pricing as { real_price?: unknown; estimated_price?: unknown; extra_shipping_price?: unknown };
  const real = num(p.real_price);
  const est = num(p.estimated_price);
  const base = real !== null && real > 0 ? real : est !== null && est > 0 ? est : null;
  if (base === null) return undefined;
  const extra = num(p.extra_shipping_price);
  return (Math.round((base + (extra !== null && extra > 0 ? extra : 0)) * 100) / 100).toFixed(2);
}

/** Order.shippingPrice (metin) → kuruş tamsayısı; boş/çevrilemez → null. */
export function shippingPriceToKurus(v: string | null | undefined): number | null {
  const n = num(v ?? "");
  return n !== null && n >= 0 ? Math.round(n * 100) : null;
}

// Admin kargo firması seçeneklerinde ham fiyat metnini Türkçe para biçimine çevirir (yalnız gösterim).
// "132.948" → "132,95 ₺"; "22.67 + KDV" → "22,67 ₺ + KDV"; sayı bulunamazsa metin olduğu gibi döner.
export function formatCarrierPriceText(raw: string): string {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(raw);
  if (!m) return raw;
  const n = Number(m[1].includes(".") ? m[1] : m[1].replace(",", "."));
  if (!Number.isFinite(n)) return raw;
  const money = `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
  const rest = m[2].replace(/^(₺|TL|TRY)\s*/i, "").trim();
  return rest ? `${money} ${rest}` : money;
}

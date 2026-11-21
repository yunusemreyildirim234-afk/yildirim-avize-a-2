// Kargonomi firma eşlemesi, fiyat karşılaştırma yanıtının savunmacı ayrıştırılması ve öneri kuralı (saf; veritabanı/ağ yok).

export const CARRIER_IDS = { ARAS: 4, HEPSIJET: 6 } as const;
export type SelectableProviderId = 4 | 6;
export const isSelectableProviderId = (v: unknown): v is SelectableProviderId => v === 4 || v === 6;

const PROVIDERS = [
  { id: 4, name: "Aras Kargo", keys: ["aras"] },
  { id: 6, name: "Hepsijet", keys: ["hepsijet"] },
  { id: 5, name: "Sürat Kargo", keys: ["surat"] },
  { id: 7, name: "PTT Kargo", keys: ["ptt"] },
  { id: 3, name: "Kolay Gelsin", keys: ["kolaygelsin", "kolay"] },
];

const norm = (v: unknown) =>
  String(v ?? "")
    .toLocaleLowerCase("tr")
    .replace(/ş/g, "s").replace(/ı/g, "i").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/ğ/g, "g")
    .replace(/[^a-z0-9]/g, "");

/** slug / ad / kimlikten bilinen firma; bulunamazsa null. */
export function resolveProvider(p: { id?: unknown; slug?: unknown; name?: unknown }): { id: number; name: string } | null {
  const slug = norm(p.slug);
  const name = norm(p.name);
  for (const x of PROVIDERS) {
    if (x.keys.some((k) => slug === k || slug.startsWith(k) || name.includes(k))) return { id: x.id, name: x.name };
  }
  const id = Number(p.id);
  const byId = PROVIDERS.find((x) => x.id === id);
  return byId ? { id: byId.id, name: byId.name } : null;
}

export interface CarrierQuote {
  providerId: number;
  name: string;
  priceText: string;
  available: boolean;
}

const PRICE_KEYS = ["price", "price_text", "formatted_price", "shipping_price", "total_price", "amount", "cost", "fee"];
const OUT_OF_SERVICE = /hizmet\s*d[ıi]ş[ıi]/i;

function priceTextOf(item: Record<string, unknown>): string {
  for (const k of PRICE_KEYS) {
    const v = item[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  // Bilinmeyen alan adı: KDV/TL/₺ içeren ya da "Hizmet Dışı" yazan ilk metin
  for (const [k, v] of Object.entries(item)) {
    if (["id", "name", "slug", "logo", "image"].includes(k)) continue;
    if (typeof v === "string" && (OUT_OF_SERVICE.test(v) || /kdv|₺|\btl\b/i.test(v))) return v.trim();
  }
  return "";
}

/** `shipping_provider_with_price` (dizi ya da kimlik→kayıt nesnesi) → yalnızca bilinen firmalar. Şekil tanınmazsa boş dizi. */
export function parseQuotes(payload: unknown): CarrierQuote[] {
  const root = payload as { shipping_provider_with_price?: unknown; data?: { shipping_provider_with_price?: unknown } } | null;
  const raw = root?.shipping_provider_with_price ?? root?.data?.shipping_provider_with_price;
  const list: unknown[] = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [];
  const out: CarrierQuote[] = [];
  for (const it of list) {
    if (!it || typeof it !== "object") continue;
    const item = it as Record<string, unknown>;
    const nested = item.shipping_provider && typeof item.shipping_provider === "object" ? (item.shipping_provider as Record<string, unknown>) : {};
    const prov = resolveProvider({ id: item.id ?? item.shipping_provider_id ?? nested.id, slug: item.slug ?? nested.slug, name: item.name ?? nested.name });
    if (!prov) continue;
    const priceText = priceTextOf(item);
    out.push({ providerId: prov.id, name: prov.name, priceText, available: priceText !== "" && !OUT_OF_SERVICE.test(priceText) });
  }
  return out;
}

/** Yalnız Aras ve Hepsijet; sıra sabit (Aras, Hepsijet). Listede olmayan firma kullanılamaz sayılır. */
export function selectableQuotes(quotes: CarrierQuote[]): CarrierQuote[] {
  return [4, 6].map(
    (id) => quotes.find((q) => q.providerId === id) ?? { providerId: id, name: id === 4 ? "Aras Kargo" : "Hepsijet", priceText: "", available: false }
  );
}

/** İstanbul içi (il 34): Aras, dışı: Hepsijet; önerilen kullanılamazsa diğeri; ikisi de yoksa null. */
export function recommendProvider(stateId: number | null | undefined, quotes: CarrierQuote[]): { providerId: SelectableProviderId; reason: string } | null {
  const inCity = (stateId ?? 34) === 34;
  const first: SelectableProviderId = inCity ? 4 : 6;
  const second: SelectableProviderId = inCity ? 6 : 4;
  const ok = (id: number) => quotes.find((q) => q.providerId === id)?.available === true;
  const reasonOf = (id: SelectableProviderId) => (id === 4 ? "İstanbul içi: Aras" : "İstanbul dışı: Hepsijet");
  if (ok(first)) return { providerId: first, reason: reasonOf(first) };
  if (ok(second)) return { providerId: second, reason: `${reasonOf(first)} önerilir ancak hizmet dışı; ${second === 4 ? "Aras" : "Hepsijet"} kullanılabilir` };
  return null;
}

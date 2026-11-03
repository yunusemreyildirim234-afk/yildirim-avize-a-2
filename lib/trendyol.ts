import type { IncomingProduct } from "@/lib/trendyol-plan";

const BASE = "https://apigw.trendyol.com/integration/product/sellers";
const PAGE_SIZE = 50;

export interface TrendyolItem {
  barcode: string;
  title: string;
  productMainId: string;
  description?: string;
  brand?: string;
  categoryName?: string;
  stockCode?: string;
  quantity: number;
  salePrice: number;
  listPrice: number;
  onSale: boolean;
  approved: boolean;
  archived: boolean;
  blacklisted: boolean;
  images?: { url: string }[];
  productUrl?: string;
  attributes?: { attributeName: string; attributeValue: string }[];
}

function credentials() {
  const supplierId = process.env.TRENDYOL_SUPPLIER_ID;
  const token =
    process.env.TRENDYOL_TOKEN ||
    Buffer.from(`${process.env.TRENDYOL_API_KEY}:${process.env.TRENDYOL_API_SECRET}`).toString("base64");
  if (!supplierId || !token) throw new Error("Trendyol API bilgileri .env içinde eksik.");
  return { supplierId, token };
}

/** Mağazadaki tüm ürünleri (sayfa sayfa) çeker. */
export async function fetchTrendyolProducts(): Promise<TrendyolItem[]> {
  const { supplierId, token } = credentials();
  const items: TrendyolItem[] = [];

  for (let page = 0; ; page++) {
    const res = await fetch(`${BASE}/${supplierId}/products?page=${page}&size=${PAGE_SIZE}`, {
      headers: { Authorization: `Basic ${token}`, "User-Agent": `${supplierId} - SelfIntegration` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Trendyol API hatası (${res.status})`);
    const data = await res.json();
    items.push(...(data.content ?? []));
    if (page + 1 >= (data.totalPages ?? 0)) break;
  }
  return items;
}

const ACCESSORY_WORDS = /(taşı|\btop\b|top taş|halka|kol şapkası|kol camı|kılıfı|tabak|ampül|duyu|tutucu|boncuk|plaket|rondela)/;
const ACCESSORY_CATEGORIES = ["ampul", "duy", "boncuk", "araç içi telefon tutucu"];

/** Başlıktaki anahtar kelimelere (Kristal, Modern, Klasik, Sarkıt, Aplik) göre site kategorisi. */
export function mapCategory(item: TrendyolItem): string {
  const t = item.title.toLocaleLowerCase("tr");
  const c = (item.categoryName ?? "").toLocaleLowerCase("tr");

  // 1. Yedek parça / aksesuar (avize taşı, ampul, duy, halka, kol şapkası ...)
  if (ACCESSORY_WORDS.test(t) || ACCESSORY_CATEGORIES.includes(c)) return "Aksesuar";

  // 2. Sarkıt & aplik & lamba
  if (/aplik|lambader|abajur|lambası/.test(t)) return "Sarkıt";
  // Trendyol kategorisi yanlış girilmiş olabilir: başlıkta "avize" geçiyorsa avizedir
  if ((c === "aplik" || c === "abajur" || c.includes("lamba")) && !t.includes("avize")) return "Sarkıt";
  if (t.includes("sarkıt") && !t.includes("avize")) return "Sarkıt";

  // 3. Avize ailesi: stil anahtar kelimeleri
  if (c === "avize" || c === "yemek masası" || /avize|yemek masası|kontes|atlantis/.test(t)) {
    if (t.includes("modern")) return "Modern";
    if (/kristal|taşlı/.test(t)) return "Kristal";
    if (/klasik|eskitme|prinç|pirinç|antik|gold|lak/.test(t)) return "Klasik";
    if (/krom|nikel|mat siyah|led/.test(t)) return "Modern";
    return "Klasik";
  }

  return "Aksesuar";
}

function variationLabel(item: TrendyolItem) {
  const attr = (name: string) => item.attributes?.find((a) => a.attributeName === name)?.attributeValue;
  const parts = [attr("Renk"), attr("Boyut/Ebat")].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Standart";
}

function cleanDescription(text?: string) {
  return (text ?? "")
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n");
}

/** Trendyol kayıtlarını ürün (productMainId) + varyasyon (barkod) olarak gruplar (saf; yazma yok). */
export function buildIncoming(items: TrendyolItem[]): IncomingProduct[] {
  const groups = new Map<string, TrendyolItem[]>();
  for (const item of items) {
    if (!item.barcode) continue;
    const list = groups.get(item.productMainId) ?? [];
    list.push(item);
    groups.set(item.productMainId, list);
  }

  const out: IncomingProduct[] = [];
  for (const [mainId, group] of groups) {
    const sellable = (i: TrendyolItem) => i.onSale && !i.archived && !i.blacklisted && i.salePrice > 0;
    const pool = group.some(sellable) ? group.filter(sellable) : group;
    const lead = pool[0];
    const basePrice = Math.min(...pool.map((i) => i.salePrice));
    const listPrice = Math.max(...pool.map((i) => i.listPrice));
    const images = [...new Set(pool.flatMap((i) => (i.images ?? []).map((img) => img.url)))];

    const seenLabels = new Set<string>();
    const variations = pool.map((item) => {
      let label = variationLabel(item);
      if (seenLabels.has(label)) label = `${label} (${item.barcode.slice(-4)})`;
      seenLabels.add(label);
      return {
        barcode: item.barcode,
        variationValue: label,
        extraPrice: item.salePrice - basePrice,
        stock: Math.max(0, item.quantity ?? 0),
        stockCode: item.stockCode || null,
        salePrice: item.salePrice,
        listPrice: item.listPrice ?? null,
      };
    });

    out.push({
      mainId,
      title: lead.title,
      description: cleanDescription(lead.description) || null,
      category: mapCategory(lead),
      basePrice,
      listPrice: listPrice > basePrice ? listPrice : null,
      images,
      active: group.some(sellable),
      brand: lead.brand ?? null,
      trendyolCategory: lead.categoryName ?? null,
      trendyolUrl: lead.productUrl ?? null,
      variations,
    });
  }
  return out;
}

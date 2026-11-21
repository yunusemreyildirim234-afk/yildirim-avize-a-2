import { FREE_SHIPPING_THRESHOLD, PICKUP_DISCOUNT, BANK_TRANSFER_DISCOUNT } from "./pricing.ts";

const ship = `${FREE_SHIPPING_THRESHOLD} TL üzeri ücretsiz kargo`;
const pickup = `Şişhane mağazadan teslimde %${Math.round(PICKUP_DISCOUNT * 100)} indirim`;

/** Sabit kategori / koleksiyon <title> + açıklama (düzen " | Yıldırım Avize" ekler). Sayfa içi h1 değişmez. {N}/fiyat aralığı eklenmez (ek sorgu yok). */
const TABLE: Record<string, { title: string; desc: string }> = {
  kristal: { title: "Kristal Avize Modelleri ve Fiyatları", desc: `El kesimi kristal taşlı avize modelleri. Montajlı gönderim, ${ship}, ${pickup}.` },
  modern: { title: "Modern Avize Modelleri ve Fiyatları", desc: `LED ve sade çizgili modern avizeler. Havale/EFT'de %${Math.round(BANK_TRANSFER_DISCOUNT * 100)} indirim, ${ship}.` },
  klasik: { title: "Klasik ve Eskitme Avize Modelleri", desc: "Eskitme ve pirinç gövdeli klasik avizeler. Beyoğlu Şişhane mağazamızdan ya da Aras Kargo / Hepsijet ile." },
  sarkit: { title: "Sarkıt ve Aplik Modelleri", desc: `Yemek masası üstü sarkıtlar, aplikler ve lambalar. ${ship}, ${pickup}.` },
  aksesuar: { title: "Avize Yedek Parça ve Kristal Taş", desc: "Kristal avize taşı, duy, zincir ve yedek parçalar. Küçük siparişlerde kargo ücreti sepette gösterilir." },
  tum: { title: "Tüm Avize Modelleri", desc: "Yıldırım Avize'nin tüm koleksiyonu: kristal, modern, klasik avizeler, sarkıt ve aplikler." },
  "cok-satanlar": { title: "En Çok Satan Avizeler", desc: "Müşterilerimizin en çok tercih ettiği avize modelleri ve güncel fiyatları." },
  indirimli: { title: "İndirimli Avizeler ve Fırsat Ürünleri", desc: "Liste fiyatının altındaki ve adet indirimi olan avize modelleri." },
};

/** `renamed`: yönetici sabit kategorinin görünen adını değiştirdiyse yeni ad (şablon dinamik gibi kurulur). `name`: dinamik kategori adı. */
export function categorySeo(slug: string, name: string, renamed = false): { title: string; desc: string } {
  const fixed = TABLE[slug];
  if (fixed && !renamed) return fixed;
  if (slug === "one-cikanlar") return { title: "Öne Çıkan Avize Modelleri", desc: "Stokta bulunan seçili avize modellerimiz ve güncel fiyatları." };
  return { title: `${name} Modelleri ve Fiyatları`, desc: `${name}: avize ve aydınlatma modelleri. ${ship}, ${pickup}.` };
}

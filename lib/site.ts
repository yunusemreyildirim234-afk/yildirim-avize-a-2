export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.yildirimavize.com.tr").replace(/\/$/, "");
export const SITE_NAME = "Yıldırım Avize";
export const PHONE_DISPLAY = "0537 211 42 23";
export const PHONE_TEL = "+905372114223";
export const WHATSAPP_NUMBER = "905372114223";
export const ADDRESS_LINE =
  "Emekyemez Mah. İskender Cad, Nazlı Hanım Sk. No:6 D:11, Şişhane Beyoğlu / İstanbul";

// İskender Cad, Şişhane / Beyoğlu
export const LAT = 41.0266295;
export const LNG = 28.970431;

export const CATEGORIES = [
  {
    slug: "kristal",
    title: "Kristal Serisi",
    dbCategory: "Kristal",
    desc: "Işıltıyı odağınıza alan el kesimi prizmatik taşlar ve pirinç döküm şıklığı.",
  },
  {
    slug: "modern",
    title: "Modern Avizeler",
    dbCategory: "Modern",
    desc: "Minimalist çizgiler, LED aydınlatmalar ve çağdaş mekanlar için mimari formlar.",
  },
  {
    slug: "klasik",
    title: "Klasik Avizeler",
    dbCategory: "Klasik",
    desc: "Beyoğlu'nun tarihi dokusundan ilham alan eskitme gövdeler ve nostaljik detaylar.",
  },
  {
    slug: "sarkit",
    title: "Sarkıt & Aplik Modelleri",
    dbCategory: "Sarkıt",
    desc: "Yemek masası üstleri, antre ve dinlenme köşeleri için sarkıt, aplik ve lambalar.",
  },
  {
    slug: "aksesuar",
    title: "Aksesuar & Yedek Parça",
    dbCategory: "Aksesuar",
    desc: "Kristal taşlar, ampul, duy ve avize yedek parçaları ile dekoratif objeler.",
  },
] as const;

// Kategori dışı özel listeler
export const COLLECTIONS = {
  tum: { title: "Tüm Ürünler", desc: "Yıldırım Avize'nin tüm koleksiyonu." },
  "one-cikanlar": { title: "Öne Çıkan Ürünler", desc: "Stokta bulunan seçili avize modellerimiz." },
  indirimli: { title: "İndirimli & Fırsat Ürünleri", desc: "Liste fiyatının altında satılan fırsat ürünleri." },
} as const;

export const ADMIN_EMAILS = ["yunusemreyildirim234@gmail.com", "omeryildirim_3@hotmail.com"];

export const BANK_INFO = {
  bank: "Kuveyt Türk",
  holder: "Ömer Yıldırım Ömer Yıldırım",
  iban: "TR350020500009989111400001",
} as const;

// Yönetim panelindeki varsayılan koleksiyonlar (value: veritabanındaki kategori adı; site kategori sayfalarıyla uyumlu)
export const COLLECTION_OPTIONS = [
  { label: "Kristal Serisi", value: "Kristal" },
  { label: "Modern Avizeler", value: "Modern" },
  { label: "Klasik Avizeler", value: "Klasik" },
  { label: "Sarkıt & Aplik Modelleri", value: "Sarkıt" },
  { label: "Aksesuar & Yedek Parça", value: "Aksesuar" },
] as const;

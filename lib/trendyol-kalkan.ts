// Trendyol'dan kalkan / kapanan VARYASYON listesi (saf: veritabanı/ağ yok). kalkanPlani yalnız gösterir; kalkanSifirlaSecimi (Aşama 4) seçilen satırları stok 0 için süzer.
// Kaynak plan: docs/kod-denetimi/plan-17/02-lib11-trn03-kalkan-varyasyon.md (Aşama 1-3).
import type { ExistingProduct, IncomingProduct, Settings } from "@/lib/trendyol-plan";

export type KalkanGuven = "KESIN" | "ZAYIF";

export interface KalkanVaryasyon {
  varyasyonId: string;
  barkod: string;
  deger: string;
  mevcutStok: number;
  rezerve: number;
  guven: KalkanGuven;
  elleDegisti: boolean;
  /** Aynı üründe aynı renk + aynı ebatta TEK eski/yeni çift varsa yeni barkod; aksi halde null (öneri yok). */
  olasiYeniBarkod: string | null;
  metin: string;
  rozetler: string[];
}
export interface KalkanUrun { mainId: string; urunId: string; baslik: string; suphe: boolean; varyasyonlar: KalkanVaryasyon[] }
export interface KalkanSonuc {
  urunler: KalkanUrun[];
  /** Listelenen (stoğu sıfırlanabilir) varyasyon sayısı */
  toplam: number;
  /** Kalkan sayılan tüm barkodlu varyasyon (stoğu zaten 0 olanlar dahil) */
  kalkanToplam: number;
  /** Trendyol listesiyle eşleşen varyasyon sayısı (genel eşik paydası) */
  eslesen: number;
  /** kalkanToplam > eşleşenin %10'u: liste eksik olabilir */
  genelUyari: boolean;
}

export const KAPALI_METIN = "Trendyol'da KAPALI -> sitede stok 0 (Tükendi) olacak";
export const YOK_METIN = "Trendyol listesinde YOK -> sitede stok 0 (Tükendi) olacak (emin değil)";
export const ROZET_ELLE = "ELLE DEĞİŞMİŞ";
export const ROZET_BARKOD = "BARKOD DEĞİŞMİŞ OLABİLİR";
export const rozetRezervasyon = (n: number) => `REZERVASYON ${n}`;

/**
 * Ürün başına şüphe eşiği (plan: max(3, %50)): en az 3 kalkan VE barkodlu varyasyonların yarısından fazlası.
 * Plandaki test örneği (4'ten 3'ü kalkan = şüpheli) bu okumayla uyuşur; "> max(3, %50)" yazımı o örneği şüpheli saymazdı.
 */
export const urunSupheli = (kalkan: number, barkodlu: number) => kalkan >= 3 && kalkan > barkodlu * 0.5;
/** Genel eşik: toplam kalkan > eşleşenin %10'u. */
export const genelSupheli = (kalkan: number, eslesen: number) => kalkan > eslesen * 0.1;

const tr = (s: string) => s.trim().toLocaleLowerCase("tr");

/**
 * Etiket "Renk / Boyut/Ebat" (lib/trendyol.ts variationLabel); aynı etiket tekrarlanırsa sonuna " (son4barkod)" eklenir.
 * Sitede ebat için ayrı sütun YOKTUR (variationType hep "Seçenek"): ebat varsa etiketin 2. parçasıdır, yoksa null.
 */
export function etiketCoz(deger: string): { renk: string; ebat: string | null } {
  const temiz = deger.replace(/\s\([^()\s]{4}\)$/, "");
  const [renk, ...kalan] = temiz.split(" / ");
  return { renk: tr(renk), ebat: kalan.length ? tr(kalan.join(" / ")) : null };
}

/**
 * Elle değişmiş stok: satışlar syncStock'u DÜŞÜRMEZ (yalnız eşitleme yazar), bu yüzden stock ≠ syncStock satılan her rengi işaretlerdi.
 * Satış stoğu yalnız azaltır → yalnız stock > syncStock (veya hiç eşitleme kaydı yokken stok > 0) kesin "elle" sayılır.
 * Elle AZALTMA ile satış ayırt edilemez; bu satırlar işaretsiz kalır (bu aşama yazmaz, yalnız gösterir).
 */
export const elleDegisti = (stock: number, syncStock: number | null) => (syncStock == null ? stock > 0 : stock > syncStock);

/**
 * mevcut/gelen: planSync girdileri. kapaliBarkodlar: Trendyol yanıtında VAR ama satılamaz (onSale=false/arşiv/kara liste/fiyat 0) barkodlar.
 * STOCK "SKIP" ise boş döner. Yalnız Trendyol'da hâlâ var olan ürünlerin içindeki varyasyonlar işlenir; barkodsuz varyasyona dokunulmaz.
 */
export function kalkanPlani(mevcut: ExistingProduct[], gelen: IncomingProduct[], kapaliBarkodlar: ReadonlySet<string>, rezerve: Record<string, number>, ayarlar: Settings): KalkanSonuc {
  const bos: KalkanSonuc = { urunler: [], toplam: 0, kalkanToplam: 0, eslesen: 0, genelUyari: false };
  if (ayarlar.STOCK === "SKIP") return bos;
  const gelenMap = new Map(gelen.map((g) => [g.mainId, g]));
  const urunler: KalkanUrun[] = [];
  let kalkanToplam = 0;
  let eslesen = 0;
  let toplam = 0;

  for (const ex of mevcut) {
    if (!ex.trendyolMainId) continue;
    const inc = gelenMap.get(ex.trendyolMainId);
    if (!inc) continue; // ürünün tamamı kalktıysa ACTIVE grubu işler
    const incCodes = new Set(inc.variations.map((v) => v.barcode));
    const barkodlu = ex.variations.filter((v) => v.barcode);
    const kalkan = barkodlu.filter((v) => !incCodes.has(v.barcode!));
    eslesen += barkodlu.length - kalkan.length;
    kalkanToplam += kalkan.length;
    if (kalkan.length === 0) continue;

    const exCodes = new Set(barkodlu.map((v) => v.barcode!));
    const yeniler = inc.variations.filter((v) => !exCodes.has(v.barcode));
    const sayim = (liste: { deger: string }[], anahtar: (d: string) => string) => {
      const m = new Map<string, number>();
      for (const x of liste) m.set(anahtar(x.deger), (m.get(anahtar(x.deger)) ?? 0) + 1);
      return m;
    };
    const tam = (d: string) => { const e = etiketCoz(d); return `${e.renk}|${e.ebat ?? ""}`; };
    const renkOf = (d: string) => etiketCoz(d).renk;
    const eskiTam = sayim(kalkan.map((v) => ({ deger: v.variationValue })), tam);
    const yeniTam = sayim(yeniler.map((v) => ({ deger: v.variationValue })), tam);
    // Ebat ayırt edilemiyorsa (etikette ebat yok) aynı renkten ürün içinde TEK satır olmalı (hem sitede hem Trendyol'da)
    const sitedeRenk = sayim(barkodlu.map((v) => ({ deger: v.variationValue })), renkOf);
    const gelenRenk = sayim(inc.variations.map((v) => ({ deger: v.variationValue })), renkOf);

    const oneri = (eski: (typeof kalkan)[number]): string | null => {
      const e = etiketCoz(eski.variationValue);
      const k = tam(eski.variationValue);
      if (eskiTam.get(k) !== 1) return null;
      const aday = yeniler.filter((y) => tam(y.variationValue) === k);
      if (aday.length !== 1 || yeniTam.get(k) !== 1) return null;
      if (e.ebat === null && (sitedeRenk.get(e.renk) !== 1 || gelenRenk.get(e.renk) !== 1)) return null;
      if (eski.stockCode && aday[0].stockCode && eski.stockCode !== aday[0].stockCode) return null;
      return aday[0].barcode;
    };

    const suphe = urunSupheli(kalkan.length, barkodlu.length);
    const vars: KalkanVaryasyon[] = [];
    for (const v of kalkan) {
      if (v.stock <= 0) continue; // sıfırlanacak bir şey yok
      const guven: KalkanGuven = kapaliBarkodlar.has(v.barcode!) ? "KESIN" : "ZAYIF";
      const el = elleDegisti(v.stock, v.syncStock);
      const rez = rezerve[v.id] ?? 0;
      const yeniBarkod = oneri(v);
      const rozetler: string[] = [];
      if (el) rozetler.push(ROZET_ELLE);
      if (rez > 0) rozetler.push(rozetRezervasyon(rez));
      if (yeniBarkod) rozetler.push(ROZET_BARKOD);
      vars.push({ varyasyonId: v.id, barkod: v.barcode!, deger: v.variationValue, mevcutStok: v.stock, rezerve: rez, guven, elleDegisti: el, olasiYeniBarkod: yeniBarkod, metin: guven === "KESIN" ? KAPALI_METIN : YOK_METIN, rozetler });
    }
    toplam += vars.length;
    if (vars.length) urunler.push({ mainId: ex.trendyolMainId, urunId: ex.id, baslik: ex.title, suphe, varyasyonlar: vars });
  }
  return { urunler, toplam, kalkanToplam, eslesen, genelUyari: kalkanToplam > 0 && genelSupheli(kalkanToplam, eslesen) };
}

export interface SifirlaIstek { varyasyonId: string; /** Önizlemede görülen stok */ stok: number }
export interface SifirlaSatir { varyasyonId: string; urunId: string; baslik: string; deger: string; eskiStok: number }
export interface SifirlaAtlanan { varyasyonId: string; neden: "LISTEDE_YOK" | "ELLE_DEGISMIS" | "STOK_DEGISTI" }
export interface SifirlaSecim { uygulanacak: SifirlaSatir[]; atlanan: SifirlaAtlanan[] }

/**
 * Kullanıcının işaretlediği satırları SUNUCUDA yeniden hesaplanan kalkan listesine karşı süzer (istemciye güvenilmez).
 * Atlananlar: güncel listede olmayanlar, elle değişmiş (stock > syncStock) olanlar, önizlemeden beri stoğu değişenler.
 * Silme yok; yalnız stock=0 ve syncStock=0 yazılır (uygulama: sifirlaKalkan, koşullu atomik UPDATE).
 */
export function kalkanSifirlaSecimi(kalkan: KalkanSonuc, istekler: SifirlaIstek[]): SifirlaSecim {
  const harita = new Map<string, { v: KalkanVaryasyon; u: KalkanUrun }>();
  for (const u of kalkan.urunler) for (const v of u.varyasyonlar) harita.set(v.varyasyonId, { v, u });
  const uygulanacak: SifirlaSatir[] = [];
  const atlanan: SifirlaAtlanan[] = [];
  const gorulen = new Set<string>();
  for (const i of istekler) {
    if (gorulen.has(i.varyasyonId)) continue;
    gorulen.add(i.varyasyonId);
    const k = harita.get(i.varyasyonId);
    if (!k) atlanan.push({ varyasyonId: i.varyasyonId, neden: "LISTEDE_YOK" });
    else if (k.v.elleDegisti) atlanan.push({ varyasyonId: i.varyasyonId, neden: "ELLE_DEGISMIS" });
    else if (k.v.mevcutStok !== i.stok) atlanan.push({ varyasyonId: i.varyasyonId, neden: "STOK_DEGISTI" });
    else uygulanacak.push({ varyasyonId: i.varyasyonId, urunId: k.u.urunId, baslik: k.u.baslik, deger: k.v.deger, eskiStok: k.v.mevcutStok });
  }
  return { uygulanacak, atlanan };
}

// SAF çekirdek: seçim, Blob yolu, manifest/kota, yazma ve geri alma planları, partili uygulama.
// Ağ, dosya, veritabanı YOK; hepsi dışarıdan verilir (testlerde sahte veritabanı ve sahte Blob kullanılır).
import { createHash } from "node:crypto";

export const HOBBY_LIMIT = 2000; // Vercel Blob Hobby: aylık yazma (advanced operation) sınırı
export const GUVENLI_SINIR = 1800; // bu ayki toplam yazma bunu aşacaksa kopyala durur
export const PARTI = 20;
export const TUVALLER = ["kare", "oran"];
const TUVAL_KISA = { kare: "kr", oran: "or" };

const TRENDYOL_RE = /^https:\/\/([a-z0-9-]+\.)*dsmcdn\.com\//i;
const BLOB_RE = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
export const trendyolMu = (u) => typeof u === "string" && TRENDYOL_RE.test(u);
export const blobMu = (u) => typeof u === "string" && BLOB_RE.test(u);

const tekil = (l) => [...new Set(l)];
const ayni = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Komut satırı: --ornek N | --urun 5,17 | --dry-run | --tuval kare|oran | --siniri-as. Bilinmeyen bayrak hatadır. */
export function argumanlar(argv) {
  const a = { ornek: null, urun: null, dryRun: false, tuval: "kare", siniriAs: false };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    const deger = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`${f} bir değer ister.`);
      return v;
    };
    if (f === "--dry-run") a.dryRun = true;
    else if (f === "--siniri-as") a.siniriAs = true;
    else if (f === "--ornek") {
      const n = Number(deger());
      if (!Number.isInteger(n) || n < 1) throw new Error("--ornek pozitif bir tam sayı olmalı.");
      a.ornek = n;
    } else if (f === "--urun") {
      a.urun = deger().split(",").map((s) => s.trim()).filter(Boolean);
      if (a.urun.length === 0) throw new Error("--urun en az bir model kodu ister.");
    } else if (f === "--tuval") {
      a.tuval = deger();
      if (!TUVALLER.includes(a.tuval)) throw new Error("--tuval kare ya da oran olmalı.");
    } else throw new Error(`Bilinmeyen bayrak: ${f}`);
  }
  return a;
}

export const kaynakHash = (url) => createHash("sha1").update(url).digest("hex").slice(0, 16);

/** Belirlenimci Blob yolu (rastgele sonek yok): aynı kaynak her zaman aynı yola gider. boyut: "b" (≤1600) | "k" (≤800). */
export const blobYolu = (productId, url, tuval, boyut) => `urun/${productId}/${kaynakHash(url)}-${TUVAL_KISA[tuval]}-${boyut}.webp`;

/** Model koduna göre (sayısal, boşlar sonda), eşitlikte kimliğe göre sıralar. Üç betik de aynı sırayı kullanır. */
export function sirala(urunler) {
  const kod = (u) => (u.modelCode != null && /^\d+$/.test(u.modelCode) ? Number(u.modelCode) : Infinity);
  return [...urunler].sort((x, y) => kod(x) - kod(y) || String(x.modelCode ?? "").localeCompare(String(y.modelCode ?? "")) || x.id.localeCompare(y.id));
}

const tumAdresler = (u) => [...u.images, u.imageUrl, ...u.variations.flatMap((v) => v.images)].filter((x) => typeof x === "string" && x);

/** Ürünün (genel + kapak + renk) henüz kopyalanmamış tekil Trendyol adresleri. */
export const urunKaynaklari = (u) => tekil(tumAdresler(u).filter(trendyolMu));

/** --urun (model kodları) ve --ornek (ilk N uygun ürün) süzgeci. Bilinmeyen model kodu hatadır. */
export function sec(urunler, { ornek, urun }, uygunMu) {
  let liste = urunler;
  if (urun) {
    const bulunan = new Set(urunler.map((u) => u.modelCode));
    const yok = urun.filter((k) => !bulunan.has(k));
    if (yok.length > 0) throw new Error(`Model kodu bulunamadı: ${yok.join(", ")}`);
    liste = liste.filter((u) => urun.includes(u.modelCode));
  }
  liste = sirala(liste.filter(uygunMu));
  return ornek ? liste.slice(0, ornek) : liste;
}

// ---------- Manifest ve kota ----------

export const bosManifest = () => ({ surum: 1, yazmalar: {}, gorseller: {} });
export const ayAnahtari = (d = new Date()) => d.toISOString().slice(0, 7);

/** Manifestteki kayıt: { b, k, ... } ya da yoksa null. */
export const manifestKaydi = (m, productId, url, tuval) => m.gorseller[productId]?.[url]?.[tuval] ?? null;

export function manifesteYaz(m, productId, url, tuval, kayit) {
  ((m.gorseller[productId] ??= {})[url] ??= {})[tuval] = kayit;
}

/** Her Blob yazma DENEMESİ sayılır (başarısız deneme de kotadan düşebilir). */
export function yazmaSay(m, ay = ayAnahtari()) {
  m.yazmalar[ay] = (m.yazmalar[ay] ?? 0) + 1;
}

/** Seçili ürünlerde, bu tuval için henüz yüklenmemiş (ürün, adres) çiftleri. */
export function bekleyenler(urunler, m, tuval) {
  return urunler.flatMap((u) => urunKaynaklari(u).filter((url) => !manifestKaydi(m, u.id, url, tuval)).map((url) => ({ productId: u.id, url })));
}

/** planlanan: yapılacak yazma sayısı (görsel başına 2). asar: bu ayki toplam GUVENLI_SINIR'ı geçer. */
export function kotaDurumu(m, planlanan, ay = ayAnahtari()) {
  const kullanilan = m.yazmalar[ay] ?? 0;
  return { ay, kullanilan, planlanan, kalan: HOBBY_LIMIT - kullanilan, sonraKalan: HOBBY_LIMIT - kullanilan - planlanan, asar: kullanilan + planlanan > GUVENLI_SINIR };
}

// ---------- Yazma / geri alma planları ----------

function planOlustur(u, cevir, imageMapEk) {
  const yeniImages = tekil(u.images.map(cevir));
  const yeniUrl = u.imageUrl ? cevir(u.imageUrl) : u.imageUrl;
  const varyasyonlar = u.variations
    .map((v) => ({ id: v.id, eski: v.images, yeni: tekil(v.images.map(cevir)) }))
    .filter((v) => !ayni(v.eski, v.yeni));
  if (ayni(u.images, yeniImages) && yeniUrl === u.imageUrl && varyasyonlar.length === 0) return null;
  return { id: u.id, modelCode: u.modelCode ?? null, eski: { images: u.images, imageUrl: u.imageUrl ?? null }, yeni: { images: yeniImages, imageUrl: yeniUrl ?? null }, varyasyonlar, imageMapEk };
}

/**
 * Trendyol → Blob. Ürünün TÜM kaynakları manifestte (bu tuval için) hazır değilse ürün hiç yazılmaz: { plan: null, eksik: n }.
 * Yazılacak bir şey yoksa { plan: null, eksik: 0 }.
 */
export function yazPlani(u, m, tuval) {
  const kaynaklar = urunKaynaklari(u);
  const esleme = {};
  let eksik = 0;
  for (const url of kaynaklar) {
    const k = manifestKaydi(m, u.id, url, tuval);
    if (k?.b && blobMu(k.b)) esleme[url] = k.b;
    else eksik++;
  }
  if (eksik > 0 || kaynaklar.length === 0) return { plan: null, eksik };
  return { plan: planOlustur(u, (x) => esleme[x] ?? x, esleme), eksik: 0 };
}

/** Blob → Trendyol (syncSnapshot.imageMap tersinden). imageMap'e ve Blob dosyalarına dokunulmaz. Geri alınacak adres yoksa null. */
export function geriAlPlani(u) {
  const ters = {};
  for (const [kaynak, blob] of Object.entries(u.imageMap ?? {})) if (typeof blob === "string") ters[blob] = kaynak;
  return planOlustur(u, (x) => ters[x] ?? x, null);
}

/** Yedek dosyası içeriği: planlanan ürünlerin yazmadan ÖNCEKİ değerleri. */
export function yedekIcerigi(planlar, bilgi) {
  return { ...bilgi, urunler: planlar.map((p) => ({ id: p.id, modelCode: p.modelCode, images: p.eski.images, imageUrl: p.eski.imageUrl, varyasyonlar: p.varyasyonlar.map((v) => ({ id: v.id, images: v.eski })) })) };
}

/**
 * Planları PARTI'lik gruplarla uygular. db: { partiYaz(planlar) → [{ id, yazildi, varyasyonAtlanan }], urunleriOku(ids) }.
 * partiYaz KOŞULLU yazar (satır hâlâ plan.eski değerindeyse); arada değişmiş ürün atlanır.
 * Her partiden sonra satırlar geri okunur ve beklenenle karşılaştırılır; uyuşmazlıkta ya da dogrula() hatasında DURUR (sonraki parti yazılmaz).
 */
export async function partilerleUygula(db, planlar, { parti = PARTI, dogrula = null, log = () => {} } = {}) {
  const ozet = { yazilan: 0, atlanan: [], varyasyonAtlanan: 0, parti: 0 };
  for (let i = 0; i < planlar.length; i += parti) {
    const grup = planlar.slice(i, i + parti);
    const sonuc = await db.partiYaz(grup);
    const yazildi = new Set(sonuc.filter((s) => s.yazildi).map((s) => s.id));
    for (const s of sonuc) {
      if (!s.yazildi) ozet.atlanan.push(s.id);
      ozet.varyasyonAtlanan += s.varyasyonAtlanan ?? 0;
    }
    const yazilanlar = grup.filter((p) => yazildi.has(p.id));
    const okunan = new Map((await db.urunleriOku(yazilanlar.map((p) => p.id))).map((u) => [u.id, u]));
    for (const p of yazilanlar) {
      const u = okunan.get(p.id);
      if (!u || !ayni(u.images, p.yeni.images) || (u.imageUrl ?? null) !== p.yeni.imageUrl) throw new Error(`Doğrulama başarısız: ürün ${p.id} beklenen değerde değil. Durduruldu.`);
      if (p.imageMapEk) for (const [k, v] of Object.entries(p.imageMapEk)) if (u.imageMap?.[k] !== v) throw new Error(`Doğrulama başarısız: ürün ${p.id} imageMap eksik. Durduruldu.`);
    }
    if (dogrula) await dogrula(yazilanlar);
    ozet.yazilan += yazilanlar.length;
    ozet.parti++;
    log(`Parti ${ozet.parti}: ${yazilanlar.length} ürün yazıldı ve doğrulandı${grup.length > yazilanlar.length ? `, ${grup.length - yazilanlar.length} atlandı (arada değişmiş)` : ""}.`);
  }
  return ozet;
}

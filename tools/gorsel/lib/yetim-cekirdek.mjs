// Yetim Blob ADAY listesi: saf çekirdek (ağ, veritabanı, dosya yok). Hiçbir şey silmez/yazmaz; yalnız sınıflandırır.
// Kaynak plan: docs/kod-denetimi/plan-17/04-lib16-blob-yetim-aday-araci.md (Aşama 1-3).
// Muhafazakâr kural: şüpheli her durum KORUNAN/TANINMAYAN olur, "aday" olmaz.

export const YAS_GUN = 30;
const GUN_MS = 24 * 60 * 60 * 1000;
const BLOB_ALAN_SONEKI = ".public.blob.vercel-storage.com";

/** Metin içindeki Blob adresleri (JS tarafı). Veritabanı tarafında aynı desen parametre olarak verilir. */
export const ADRES_DESENI = "https?://[A-Za-z0-9.-]+\\.public\\.blob\\.vercel-storage\\.com/[^\\s\"'<>)\\\\]+";

/** Adres → Blob yolu (küçük harf alan adı, ?query/#hash atılır, %-kodlaması çözülür). Blob adresi değilse null. */
export function adresYolu(adres) {
  let u;
  try {
    u = new URL(String(adres).replace(/[.,;:]+$/, ""));
  } catch {
    return null;
  }
  if (!u.hostname.toLowerCase().endsWith(BLOB_ALAN_SONEKI)) return null;
  let yol = u.pathname.replace(/^\/+/, "");
  try {
    yol = decodeURIComponent(yol);
  } catch {
    /* çözülemeyen kodlama: ham yol kalır */
  }
  return yol || null;
}

/** Serbest metinden (JSON, markdown, kaynak kodu) Blob yollarını çıkarır. */
export function metindenYollar(metin) {
  const out = new Set();
  for (const m of String(metin ?? "").matchAll(new RegExp(ADRES_DESENI, "g"))) {
    const y = adresYolu(m[0]);
    if (y) out.add(y);
  }
  return out;
}

/** "-b.webp" / "-k.webp" sonekini atar: iki boyut aynı tabanı paylaşır (biri referanslıysa ikisi de referanslı). */
export const tabanYol = (yol) => yol.replace(/-(b|k)\.webp$/i, "");

// urun/<kimlik|yeni>/<özet 16-40 hex>(-kr|-or)?(-v2)?-(b|k).webp  (yönetici yüklemesi: sha1 40; araç v2: 16 hex + tuval + v2; araç v1: 16 hex + tuval)
const YOL_DESENI = /^urun\/([A-Za-z0-9_-]+)\/([0-9a-f]{16,40})(?:-(kr|or))?(-v2)?-(b|k)\.webp$/;

/** Yolu çözer; desen dışıysa tanindi=false (aday olamaz). */
export function yolCoz(yol) {
  const m = YOL_DESENI.exec(yol);
  if (!m) return { tanindi: false, taban: tabanYol(yol) };
  const [, klasor, ozet, tuval, v2] = m;
  return { tanindi: true, klasor, yeniKlasor: klasor === "yeni", ozet, tuval: tuval ?? null, surum: v2 ? "v2" : tuval ? "v1" : "yukleme", taban: tabanYol(yol) };
}

export const SINIFLAR = {
  REFERANSLI: "REFERANSLI",
  KORUNAN: "KORUNAN",
  TANINMAYAN: "TANINMAYAN",
  S1: "ADAY-S1", // ürün kimliği veritabanında yok (silinmiş ürün)
  S2: "ADAY-S2", // ürün var, görsel hiçbir yerde yok (üründen çıkarılmış)
  S3: "ADAY-S3", // urun/yeni/ ≥ eşik gün (iptal edilen form)
  S4: "ADAY-S4", // v1 dosyası: v2 karşılığı var, yedek/manifestte geçmiyor
};

/**
 * @param {object} g
 * @param {{pathname:string,size:number,uploadedAt:Date|string}[]} g.bloblar   Blob envanteri
 * @param {Iterable<string>} g.dbYollari        Veritabanı referansları (1. okuma)
 * @param {Iterable<string>} g.dbYollari2       Rapor öncesi 2. okuma (yarış kapanışı)
 * @param {Map<string,string>|Iterable<string>} g.dosyaYollari  manifest/yedek/depo kaynağı referansları
 * @param {Iterable<string>} g.urunIdleri       Veritabanındaki Product.id değerleri
 * @param {Date} g.simdi
 * @param {number} [g.yasGun]
 */
export function analizEt({ bloblar, dbYollari, dbYollari2, dosyaYollari, urunIdleri, simdi, yasGun = YAS_GUN }) {
  const taban = (set) => new Set([...set].map(tabanYol));
  const db1 = taban(dbYollari);
  const db2 = taban(dbYollari2 ?? dbYollari);
  const dosya = taban(dosyaYollari instanceof Map ? dosyaYollari.keys() : dosyaYollari);
  const idler = new Set(urunIdleri);
  const v2Var = new Set(bloblar.map((b) => yolCoz(b.pathname)).filter((c) => c.tanindi && c.surum === "v2").map((c) => `${c.klasor}/${c.ozet}/${c.tuval}`));

  const satirlar = bloblar.map((b) => {
    const yol = b.pathname;
    const c = yolCoz(yol);
    const yas = (simdi.getTime() - new Date(b.uploadedAt).getTime()) / GUN_MS;
    const t = new Date(b.uploadedAt);
    const sat = (sinif, neden) => ({ yol, boyut: b.size ?? 0, tarih: Number.isNaN(t.getTime()) ? "" : t.toISOString(), sinif, neden });
    if (db1.has(c.taban)) return sat(SINIFLAR.REFERANSLI, "veritabanında referans var");
    if (dosya.has(c.taban)) return sat(SINIFLAR.KORUNAN, "manifest/yedek/depo kaynağında geçiyor");
    if (!c.tanindi) return sat(SINIFLAR.TANINMAYAN, "yol deseni tanınmıyor");
    if (!Number.isFinite(yas)) return sat(SINIFLAR.KORUNAN, "yükleme tarihi okunamadı");
    if (yas < yasGun) return sat(SINIFLAR.KORUNAN, `taze (${Math.floor(yas)} gün < ${yasGun})`);
    if (db2.has(c.taban)) return sat(SINIFLAR.KORUNAN, "ikinci kontrolde yeni referans çıktı");
    if (c.yeniKlasor) return sat(SINIFLAR.S3, "urun/yeni: iptal edilmiş form yüklemesi olabilir");
    if (!idler.has(c.klasor)) return sat(SINIFLAR.S1, "ürün kimliği veritabanında yok");
    if (c.surum === "v1" && v2Var.has(`${c.klasor}/${c.ozet}/${c.tuval}`)) return sat(SINIFLAR.S4, "v1 dosyası; v2 karşılığı var");
    return sat(SINIFLAR.S2, "ürün var ama görsel hiçbir yerde kullanılmıyor");
  });
  return { satirlar, ozet: ozetle(satirlar) };
}

const aday = (s) => s.sinif.startsWith("ADAY-");

export function ozetle(satirlar) {
  const topla = (liste) => liste.reduce((t, s) => t + s.boyut, 0);
  const sinif = {};
  for (const s of satirlar) sinif[s.sinif] = (sinif[s.sinif] ?? 0) + 1;
  const adaylar = satirlar.filter(aday);
  return {
    toplam: satirlar.length,
    toplamBayt: topla(satirlar),
    referansli: satirlar.filter((s) => s.sinif === SINIFLAR.REFERANSLI).length,
    korunan: satirlar.filter((s) => s.sinif === SINIFLAR.KORUNAN).length,
    tanimayan: satirlar.filter((s) => s.sinif === SINIFLAR.TANINMAYAN).length,
    aday: adaylar.length,
    adayBayt: topla(adaylar),
    siniflar: sinif,
  };
}

const mb = (b) => (b / 1024 / 1024).toFixed(1);
export function ozetMetni(o) {
  return `Toplam ${o.toplam} dosya (${mb(o.toplamBayt)} MB) · Referanslı ${o.referansli} · Korunan ${o.korunan} · TANINMAYAN ${o.tanimayan} · ADAY ${o.aday} dosya (${mb(o.adayBayt)} MB)`;
}

const csvHucre = (v) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const csvUret = (satirlar) => ["yol,boyut,tarih,sinif,neden", ...satirlar.map((s) => [s.yol, s.boyut, s.tarih, s.sinif, s.neden].map(csvHucre).join(","))].join("\n");

/** Blob envanterini sayfa sayfa toplar. istemci.liste({cursor}) → {blobs, cursor?, hasMore}. Yalnız okur. */
export async function envanterTopla(istemci, { enCokSayfa = 1000 } = {}) {
  const hepsi = [];
  let cursor;
  for (let i = 0; i < enCokSayfa; i++) {
    const s = await istemci.liste({ cursor });
    hepsi.push(...s.blobs);
    if (!s.hasMore || !s.cursor) return hepsi;
    cursor = s.cursor;
  }
  throw new Error("Blob sayfa sınırı aşıldı; envanter eksik olabilir (rapor üretilmedi).");
}

// Görsel işleme (sharp): zemin sınıflandırma → (gerekirse) yalnızca DÜZ BEYAZ şeritleri atma → KARE tuval → WebP (büyük ≤1600, küçük ≤800).
// Ürünün hiçbir pikseli kesilmez. Ağ/dosya yok: Buffer alır, Buffer verir.
import sharp from "sharp";

export const BUYUK = 1600;
export const KUCUK = 800;
const SERIT = 253; // bu değerin üstü (her kanal) "düz beyaz" şerit pikselidir (Trendyol'un eklediği)
const SERIT_ORAN = 0.995; // satır/sütunun bu kadarı düz beyazsa şerittir
const RENKLI_ESIK = 215; // kenar halkası medyanı (en koyu kanal) bundan koyuysa zemin belirgin biçimde beyaz DEĞİL: yalnızca düz beyaz şeritler atılır. Açık/belirsizse HİÇ kırpılmaz
const TEK_RENK_FARK = 24; // halka pikselinin medyandan en çok bu kadar sapması "tek renk" sayılır
const TEK_RENK_ORAN = 0.85;
const BEYAZ_RENK = { r: 255, g: 255, b: 255 };

const ham = (data, w, h) => sharp(data, { raw: { width: w, height: h, channels: 3 } });
const beyazPiksel = (data, i) => data[i] >= SERIT && data[i + 1] >= SERIT && data[i + 2] >= SERIT;

/** Dış kenarlardan içeri doğru düz beyaz satır/sütunları atar. Dönen: { left, top, width, height } ya da (tümü beyazsa) null. */
function serit(data, W, H) {
  let top = 0;
  let bottom = H;
  let left = 0;
  let right = W;
  const satirBeyaz = (y) => {
    let n = 0;
    for (let x = left; x < right; x++) if (beyazPiksel(data, (y * W + x) * 3)) n++;
    return n >= (right - left) * SERIT_ORAN;
  };
  const sutunBeyaz = (x) => {
    let n = 0;
    for (let y = top; y < bottom; y++) if (beyazPiksel(data, (y * W + x) * 3)) n++;
    return n >= (bottom - top) * SERIT_ORAN;
  };
  for (let degisti = true; degisti && top < bottom && left < right; ) {
    degisti = false;
    while (top < bottom && satirBeyaz(top)) (top++, (degisti = true));
    while (bottom > top && satirBeyaz(bottom - 1)) (bottom--, (degisti = true));
    while (left < right && sutunBeyaz(left)) (left++, (degisti = true));
    while (right > left && sutunBeyaz(right - 1)) (right--, (degisti = true));
  }
  return top >= bottom || left >= right ? null : { left, top, width: right - left, height: bottom - top };
}

/** Kutunun dış kenar halkasındaki piksellerin kanal medyanı ve "tek renk" olup olmadığı. */
function halka(data, W, k) {
  const p = Math.max(2, Math.round(Math.min(k.width, k.height) * 0.015));
  const kanal = [[], [], []];
  const ekle = (x, y) => {
    const i = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) kanal[c].push(data[i + c]);
  };
  const yp = Math.min(p, Math.floor(k.height / 2));
  const xp = Math.min(p, Math.floor(k.width / 2));
  for (let y = k.top; y < k.top + k.height; y++) {
    const kenarSatir = y < k.top + yp || y >= k.top + k.height - yp;
    for (let x = k.left; x < k.left + k.width; x++) if (kenarSatir || x < k.left + xp || x >= k.left + k.width - xp) ekle(x, y);
  }
  const medyan = kanal.map((a) => (a.sort((x, y) => x - y), a[a.length >> 1]));
  let yakin = 0;
  for (let j = 0; j < kanal[0].length; j++) if ([0, 1, 2].every((c) => Math.abs(kanal[c][j] - medyan[c]) <= TEK_RENK_FARK)) yakin++;
  return { renk: { r: medyan[0], g: medyan[1], b: medyan[2] }, tekRenk: yakin / kanal[0].length >= TEK_RENK_ORAN };
}

/**
 * Karar. durum: "kirpildi" (zemin belirgin biçimde beyaz değil; YALNIZCA düz beyaz şeritler atıldı) | "kirpilmadi" (hiçbir şey atılmadı).
 * dolgu: kare tuvalin boş kısımları — { tur: "beyaz" | "renk" | "kenar", renk }: beyaz (kristal/cam/beyaz zeminli ya da belirsiz), renk (tek renkli zemin: o renk),
 * kenar (tek renk değil: kenar pikselleri uzatılır). kutu: orijinal üzerinde korunan alan (pay eklenmez).
 */
function karar(data, W, H) {
  const tam = { left: 0, top: 0, width: W, height: H };
  const beyazDolgu = { tur: "beyaz", renk: BEYAZ_RENK };
  const k = serit(data, W, H);
  if (!k) return { durum: "kirpilmadi", dolgu: beyazDolgu, kutu: tam };
  if (k.width < W && k.height < H) return { durum: "kirpilmadi", dolgu: beyazDolgu, kutu: tam }; // şerit tek eksende olur (Trendyol oranı doldurur); iki eksende atılıyorsa bu bir ürün sınırıdır → kırpma
  const h = halka(data, W, k);
  const beyazlik = Math.min(h.renk.r, h.renk.g, h.renk.b);
  if (beyazlik >= RENKLI_ESIK) return { durum: "kirpilmadi", dolgu: beyazDolgu, kutu: tam }; // beyaz/açık ya da belirsiz → güvenli taraf
  const dolgu = h.tekRenk ? { tur: "renk", renk: h.renk } : { tur: "kenar", renk: h.renk };
  const kirpildi = k.width < W || k.height < H;
  return { durum: kirpildi ? "kirpildi" : "kirpilmadi", dolgu, kutu: kirpildi ? k : tam };
}

async function webp(data, w, h, enCok, kalite) {
  const { data: buf, info } = await ham(data, w, h)
    .resize({ width: enCok, height: enCok, fit: "inside", withoutEnlargement: true })
    .webp({ quality: kalite, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  return { buf, w: info.width, h: info.height };
}

/**
 * Görseli işler. tuvaller: ["kare"] | ["oran"] | ikisi.
 *  - kare (varsayılan): görsel (gerekirse yalnızca düz beyaz şeritleri atılmış) KARE tuvalin ortasına konur; boş kısımlar dolgu ile doldurulur.
 *  - oran: aynı kırpma, tuval yok (oran korunur).
 * Dönen: { kaynak: {w,h}, durum, dolgu, kutu, ciktilar: { [tuval]: { b, k, w, h } } } (b/k: Buffer; w/h: büyük sürümün boyutu)
 */
export async function isle(girdi, tuvaller = ["kare"]) {
  const { data, info } = await sharp(girdi, { failOn: "none" }).rotate().flatten({ background: BEYAZ_RENK }).toColourspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new Error(`Beklenmeyen kanal sayısı: ${info.channels}`);
  const W = info.width;
  const H = info.height;
  const kr = karar(data, W, H);
  const kirpik = await ham(data, W, H).extract(kr.kutu).raw().toBuffer({ resolveWithObject: true });
  const ciktilar = {};
  for (const tuval of tuvaller) {
    let src = kirpik;
    const { width: w, height: h } = kirpik.info;
    if (tuval === "kare" && w !== h) {
      const kenar = Math.max(w, h);
      const dx = kenar - w;
      const dy = kenar - h;
      const uzat = { left: Math.floor(dx / 2), right: Math.ceil(dx / 2), top: Math.floor(dy / 2), bottom: Math.ceil(dy / 2) };
      src = await ham(kirpik.data, w, h)
        .extend(kr.dolgu.tur === "kenar" ? { ...uzat, extendWith: "copy" } : { ...uzat, background: kr.dolgu.renk })
        .raw()
        .toBuffer({ resolveWithObject: true });
    }
    const b = await webp(src.data, src.info.width, src.info.height, BUYUK, 82);
    const k = await webp(src.data, src.info.width, src.info.height, KUCUK, 78);
    ciktilar[tuval] = { b: b.buf, k: k.buf, w: b.w, h: b.h };
  }
  return { kaynak: { w: W, h: H }, durum: kr.durum, dolgu: kr.dolgu, kutu: kr.kutu, ciktilar };
}

/** Önizleme için orijinalin küçültülmüş (kırpılmamış) kopyası. */
export async function orijinalKucuk(girdi) {
  return sharp(girdi, { failOn: "none" }).rotate().resize({ width: KUCUK, height: KUCUK, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}

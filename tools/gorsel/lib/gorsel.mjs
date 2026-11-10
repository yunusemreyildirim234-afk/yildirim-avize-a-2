// Görsel işleme (sharp): zemin sınıflandırma → (gerekirse) yalnızca DÜZ BEYAZ şeritleri atma → KARE tuval → WebP (büyük ≤1600, küçük ≤800).
// Ürünün hiçbir pikseli kesilmez. Ağ/dosya yok: Buffer alır, Buffer verir.
import sharp from "sharp";

export const BUYUK = 1600;
export const KUCUK = 800;
const SERIT = 253; // bu değerin üstü (her kanal) "düz beyaz" şerit pikselidir (Trendyol'un eklediği)
const SERIT_ORAN = 0.995; // satır/sütunun bu kadarı düz beyazsa şerittir
const RENKLI_ESIK = 215; // kenar halkası medyanı (en koyu kanal) bundan koyuysa zemin belirgin biçimde beyaz DEĞİL: yalnızca düz beyaz şeritler atılır. Açık/belirsizse HİÇ kırpılmaz
const BEYAZ_DOLGU = 245; // kırpılan alanın kenar halkası medyanı (en koyu kanal) bundan açıksa dolgu saf beyaz; değilse bulanık arka plan
const KARE_ORAN = 0.03; // en/boy oranı 1 ± bu kadarsa dolgu eklenmez (kenar pikseli birkaç px uzatılır)
const GECIS = 0.015; // fotoğraf kenarından dışa doğru bulanık dolguya yumuşak geçiş (kare kenarının oranı)
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

/** Kutunun dış kenar halkasındaki piksellerin kanal medyanı ({ r, g, b }). */
function halka(data, W, k) {
  const p = Math.max(2, Math.round(Math.min(k.width, k.height) * 0.015));
  const kanal = [[], [], []];
  const yp = Math.min(p, Math.floor(k.height / 2));
  const xp = Math.min(p, Math.floor(k.width / 2));
  for (let y = k.top; y < k.top + k.height; y++) {
    const kenarSatir = y < k.top + yp || y >= k.top + k.height - yp;
    for (let x = k.left; x < k.left + k.width; x++) {
      if (!(kenarSatir || x < k.left + xp || x >= k.left + k.width - xp)) continue;
      const i = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) kanal[c].push(data[i + c]);
    }
  }
  const m = kanal.map((a) => (a.sort((x, y) => x - y), a[a.length >> 1]));
  return { r: m[0], g: m[1], b: m[2] };
}

/**
 * Karar. durum: "kirpildi" (zemin belirgin biçimde beyaz değil; YALNIZCA düz beyaz şeritler atıldı) | "kirpilmadi" (hiçbir şey atılmadı).
 * kutu: orijinal üzerinde korunan alan (pay eklenmez). dolgu: kare tuvalin boş kısmı —
 *   "yok" (oran 1 ± %3: kenar pikseli birkaç px uzatılır) | "beyaz" (kutu kenarları ≥245: saf beyaz) | "bulanik" (aynı fotoğrafın büyütülüp bulanıklaştırılmış hali).
 */
function karar(data, W, H) {
  const tam = { left: 0, top: 0, width: W, height: H };
  let kutu = tam;
  let durum = "kirpilmadi";
  const k = serit(data, W, H);
  // Şerit tek eksende olur (Trendyol oranı doldurur); iki eksende atılıyorsa bu bir ürün sınırıdır → kırpma
  if (k && !(k.width < W && k.height < H) && (k.width < W || k.height < H) && Math.min(...Object.values(halka(data, W, k))) < RENKLI_ESIK) {
    kutu = k;
    durum = "kirpildi";
  }
  const oran = kutu.width / kutu.height;
  const kenar = halka(data, W, kutu);
  const dolgu = Math.abs(oran - 1) <= KARE_ORAN ? { tur: "yok" } : Math.min(kenar.r, kenar.g, kenar.b) >= BEYAZ_DOLGU ? { tur: "beyaz" } : { tur: "bulanik" };
  return { durum, dolgu, kutu };
}

/**
 * Fotoğrafı (ham RGB, w×h) KARE tuvalin ortasına koyar; fotoğraf pikselleri BİREBİR korunur. Dönen: { data, side, dx, dy }.
 * dolgu: "yok" | "beyaz" | "bulanik". Bulanık dolgu: fotoğrafın kareyi dolduracak büyütülmüş + güçlü bulanık hali; fotoğraf kenarının hemen dışında
 * kenar pikseli uzatması (dikişsiz süreklilik) yumuşakça bulanığa geçer.
 */
export async function kareTuval(data, w, h, dolgu) {
  const side = Math.max(w, h);
  if (w === h) return { data, side, dx: 0, dy: 0 };
  const dx = Math.floor((side - w) / 2);
  const dy = Math.floor((side - h) / 2);
  const uzat = { left: dx, right: side - w - dx, top: dy, bottom: side - h - dy };
  if (dolgu === "beyaz") {
    const o = await ham(data, w, h).extend({ ...uzat, background: BEYAZ_RENK }).raw().toBuffer();
    return { data: o, side, dx, dy };
  }
  const kenar = await ham(data, w, h).extend({ ...uzat, extendWith: "copy" }).raw().toBuffer();
  if (dolgu === "yok") return { data: kenar, side, dx, dy };
  const kucuk = Math.min(side, 320);
  const bulanik = await ham(data, w, h)
    .resize(kucuk, kucuk, { fit: "cover" })
    .blur(Math.max(1, kucuk * 0.05))
    .resize(side, side)
    .raw()
    .toBuffer();
  const out = Buffer.from(kenar);
  const gecis = Math.max(2, Math.round(side * GECIS));
  for (let y = 0; y < side; y++) {
    const d = y < dy ? dy - y : y >= dy + h ? y - (dy + h - 1) : 0;
    for (let x = 0; x < side; x++) {
      const e = d || (x < dx ? dx - x : x >= dx + w ? x - (dx + w - 1) : 0);
      if (e === 0) continue;
      let t = Math.min(1, e / gecis);
      t = t * t * (3 - 2 * t);
      const i = (y * side + x) * 3;
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(kenar[i + c] * (1 - t) + bulanik[i + c] * t);
    }
  }
  return { data: out, side, dx, dy };
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
 *  - kare (varsayılan): görsel (gerekirse yalnızca düz beyaz şeritleri atılmış) KARE tuvalin ortasına konur; boş kısım beyaz ya da bulanık arka planla dolar.
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
    let src = { data: kirpik.data, w: kirpik.info.width, h: kirpik.info.height };
    if (tuval === "kare" && src.w !== src.h) {
      const t = await kareTuval(src.data, src.w, src.h, kr.dolgu.tur);
      src = { data: t.data, w: t.side, h: t.side };
    }
    const b = await webp(src.data, src.w, src.h, BUYUK, 82);
    const k = await webp(src.data, src.w, src.h, KUCUK, 78);
    ciktilar[tuval] = { b: b.buf, k: k.buf, w: b.w, h: b.h };
  }
  return { kaynak: { w: W, h: H }, durum: kr.durum, dolgu: kr.dolgu, kutu: kr.kutu, ciktilar };
}

/** Önizleme için orijinalin küçültülmüş (kırpılmamış) kopyası. */
export async function orijinalKucuk(girdi) {
  return sharp(girdi, { failOn: "none" }).rotate().resize({ width: KUCUK, height: KUCUK, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}

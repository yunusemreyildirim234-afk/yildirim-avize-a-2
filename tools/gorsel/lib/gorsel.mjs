// Görsel işleme (sharp): beyaz zemin tespiti → güvenli kırpma → tuval → WebP (büyük ≤1600, küçük ≤800).
// Ağ/dosya yok: Buffer alır, Buffer verir.
import sharp from "sharp";

export const BUYUK = 1600;
export const KUCUK = 800;
const BEYAZ = 245; // dört köşenin de ortalaması bundan açık olmalı
const ESIK = 6; // zemin renginden bu kadar farklı piksel "ürün" sayılır (düşük: soluk kristal kenarları da ürün sayılsın)
const PAY = 0.06; // kırpılan kutunun çevresine ORİJİNAL görselden geri eklenen pay (soluk kristal kenarları için)
const EN_AZ = 0.35; // kırpılan alanın HEM eni HEM boyu orijinalin bu oranından küçükse kırpılmaz (ince uzun sarkıt kırpılır; minik kalıntı kırpılmaz)
const BEYAZ_RENK = { r: 255, g: 255, b: 255 };

const ham = (data, w, h) => sharp(data, { raw: { width: w, height: h, channels: 3 } });

/**
 * Dört köşedeki küçük karelerin her kanal ortalaması beyaza yakınsa zemin rengini ({ r, g, b }: köşelerin ortalaması) verir, değilse null.
 * Ham pikselden hesaplanır (sharp.stats() işlem öncesi görseli ölçer). Kırık beyaz zeminde kırpma ve tuval bu renkle yapılır (dikiş izi olmaz).
 */
function zeminRengi(data, W, H) {
  const genel = [0, 0, 0];
  const p = Math.min(W, H, Math.max(4, Math.round(Math.min(W, H) * 0.03)));
  for (const [left, top] of [[0, 0], [W - p, 0], [0, H - p], [W - p, H - p]]) {
    const toplam = [0, 0, 0];
    for (let y = top; y < top + p; y++) {
      for (let x = left; x < left + p; x++) {
        const i = (y * W + x) * 3;
        toplam[0] += data[i];
        toplam[1] += data[i + 1];
        toplam[2] += data[i + 2];
      }
    }
    if (toplam.some((t) => t / (p * p) < BEYAZ)) return null;
    for (let c = 0; c < 3; c++) genel[c] += toplam[c] / (p * p) / 4;
  }
  return { r: Math.round(genel[0]), g: Math.round(genel[1]), b: Math.round(genel[2]) };
}

/**
 * Kırpma kararı. durum: "kirpildi" | "kenar-yok" (beyaz zemin ama kırpılacak kenar yok) | "asiri-kirpma" (güvenlik: kırpılmadı) |
 * "zemin-beyaz-degil" (ortam fotoğrafı: dokunulmaz). kutu: orijinal üzerindeki son alan (pay dahil).
 */
async function kirpmaKarari(data, W, H) {
  const tam = { left: 0, top: 0, width: W, height: H };
  const zemin = zeminRengi(data, W, H);
  if (!zemin) return { beyazZemin: false, zemin: null, durum: "zemin-beyaz-degil", kutu: tam };
  let info;
  try {
    ({ info } = await ham(data, W, H).trim({ background: zemin, threshold: ESIK }).raw().toBuffer({ resolveWithObject: true }));
  } catch {
    return { beyazZemin: true, zemin, durum: "kenar-yok", kutu: tam };
  }
  if (info.width < W * EN_AZ && info.height < H * EN_AZ) return { beyazZemin: true, zemin, durum: "asiri-kirpma", kutu: tam };
  const l = -(info.trimOffsetLeft ?? 0);
  const t = -(info.trimOffsetTop ?? 0);
  const pay = Math.round(Math.max(info.width, info.height) * PAY);
  const left = Math.max(0, l - pay);
  const top = Math.max(0, t - pay);
  const right = Math.min(W, l + info.width + pay);
  const bottom = Math.min(H, t + info.height + pay);
  const kutu = { left, top, width: right - left, height: bottom - top };
  const kirpildi = kutu.width < W || kutu.height < H;
  return { beyazZemin: true, zemin, durum: kirpildi ? "kirpildi" : "kenar-yok", kutu: kirpildi ? kutu : tam };
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
 *  - kare: beyaz zeminli görsel kırpılır ve zemin renginde KARE tuvale ortalanır.
 *  - oran: beyaz zeminli görsel yalnızca kırpılır, oranı korunur.
 *  - Beyaz zeminli olmayan (ortam) görsele iki modda da dokunulmaz (yalnızca WebP + boyut).
 * Dönen: { kaynak: {w,h}, beyazZemin, durum, kutu, ciktilar: { [tuval]: { b, k, w, h } } } (b/k: Buffer; w/h: büyük sürümün boyutu)
 */
export async function isle(girdi, tuvaller = ["kare"]) {
  const { data, info } = await sharp(girdi, { failOn: "none" }).rotate().flatten({ background: BEYAZ_RENK }).toColourspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new Error(`Beklenmeyen kanal sayısı: ${info.channels}`);
  const W = info.width;
  const H = info.height;
  const karar = await kirpmaKarari(data, W, H);
  const kirpik = await ham(data, W, H).extract(karar.kutu).raw().toBuffer({ resolveWithObject: true });
  const ciktilar = {};
  for (const tuval of tuvaller) {
    let src = kirpik;
    if (tuval === "kare" && karar.beyazZemin && kirpik.info.width !== kirpik.info.height) {
      const kenar = Math.max(kirpik.info.width, kirpik.info.height);
      const dx = kenar - kirpik.info.width;
      const dy = kenar - kirpik.info.height;
      src = await ham(kirpik.data, kirpik.info.width, kirpik.info.height)
        .extend({ left: Math.floor(dx / 2), right: Math.ceil(dx / 2), top: Math.floor(dy / 2), bottom: Math.ceil(dy / 2), background: karar.zemin })
        .raw()
        .toBuffer({ resolveWithObject: true });
    }
    const b = await webp(src.data, src.info.width, src.info.height, BUYUK, 82);
    const k = await webp(src.data, src.info.width, src.info.height, KUCUK, 78);
    ciktilar[tuval] = { b: b.buf, k: k.buf, w: b.w, h: b.h };
  }
  return { kaynak: { w: W, h: H }, beyazZemin: karar.beyazZemin, durum: karar.durum, kutu: karar.kutu, ciktilar };
}

/** Önizleme için orijinalin küçültülmüş (kırpılmamış) kopyası. */
export async function orijinalKucuk(girdi) {
  return sharp(girdi, { failOn: "none" }).rotate().resize({ width: KUCUK, height: KUCUK, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}

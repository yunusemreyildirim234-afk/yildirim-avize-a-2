// Yönetici yüklemesi için görsel işleme (sharp). tools/gorsel/lib/gorsel.mjs ile AYNI kural: EXIF yönü düzelt → (gerekirse) yalnızca düz beyaz şeritleri at →
// KARE tuval (zaten kareye yakınsa dolgu yok; kenarlar beyazsa beyaz dolgu; değilse bulanık arka plan) → WebP: büyük (≤1600) ve küçük (≤800). Ürün pikselleri korunur.
import sharp from "sharp";

export const BIG_MAX = 1600;
export const SMALL_MAX = 800;
const STRIP = 253;
const STRIP_RATIO = 0.995;
const COLORED_LIMIT = 215;
const WHITE_FILL = 245;
const SQUARE_TOLERANCE = 0.03;
const BLEND = 0.015;
const WHITE = { r: 255, g: 255, b: 255 };

type Box = { left: number; top: number; width: number; height: number };
type Fill = "none" | "white" | "blur";
type Raw = { data: Buffer; w: number; h: number };

const raw = (data: Buffer, w: number, h: number) => sharp(data, { raw: { width: w, height: h, channels: 3 } });
const isWhite = (d: Buffer, i: number) => d[i] >= STRIP && d[i + 1] >= STRIP && d[i + 2] >= STRIP;

/** Dış kenarlardan içeri doğru düz beyaz satır/sütunları atar; tümü beyazsa null. */
function strips(d: Buffer, W: number, H: number): Box | null {
  let top = 0;
  let bottom = H;
  let left = 0;
  let right = W;
  const rowWhite = (y: number) => {
    let n = 0;
    for (let x = left; x < right; x++) if (isWhite(d, (y * W + x) * 3)) n++;
    return n >= (right - left) * STRIP_RATIO;
  };
  const colWhite = (x: number) => {
    let n = 0;
    for (let y = top; y < bottom; y++) if (isWhite(d, (y * W + x) * 3)) n++;
    return n >= (bottom - top) * STRIP_RATIO;
  };
  for (let changed = true; changed && top < bottom && left < right; ) {
    changed = false;
    while (top < bottom && rowWhite(top)) (top++, (changed = true));
    while (bottom > top && rowWhite(bottom - 1)) (bottom--, (changed = true));
    while (left < right && colWhite(left)) (left++, (changed = true));
    while (right > left && colWhite(right - 1)) (right--, (changed = true));
  }
  return top >= bottom || left >= right ? null : { left, top, width: right - left, height: bottom - top };
}

/** Kutunun dış kenar halkasındaki piksellerin kanal medyanı. */
function ring(d: Buffer, W: number, k: Box): [number, number, number] {
  const p = Math.max(2, Math.round(Math.min(k.width, k.height) * 0.015));
  const yp = Math.min(p, Math.floor(k.height / 2));
  const xp = Math.min(p, Math.floor(k.width / 2));
  const ch: number[][] = [[], [], []];
  for (let y = k.top; y < k.top + k.height; y++) {
    const edgeRow = y < k.top + yp || y >= k.top + k.height - yp;
    for (let x = k.left; x < k.left + k.width; x++) {
      if (!(edgeRow || x < k.left + xp || x >= k.left + k.width - xp)) continue;
      const i = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) ch[c].push(d[i + c]);
    }
  }
  const m = ch.map((a) => a.sort((x, y) => x - y)[a.length >> 1]);
  return [m[0], m[1], m[2]];
}

/** Karar: korunan kutu (yalnızca düz beyaz şeritler atılabilir) ve kare tuvalin dolgu türü. */
export function decide(d: Buffer, W: number, H: number): { box: Box; fill: Fill; cropped: boolean } {
  let box: Box = { left: 0, top: 0, width: W, height: H };
  let cropped = false;
  const k = strips(d, W, H);
  if (k && !(k.width < W && k.height < H) && (k.width < W || k.height < H) && Math.min(...ring(d, W, k)) < COLORED_LIMIT) {
    box = k;
    cropped = true;
  }
  const ratio = box.width / box.height;
  const edge = ring(d, W, box);
  const fill: Fill = Math.abs(ratio - 1) <= SQUARE_TOLERANCE ? "none" : Math.min(...edge) >= WHITE_FILL ? "white" : "blur";
  return { box, fill, cropped };
}

/** Fotoğrafı KARE tuvalin ortasına koyar; fotoğraf pikselleri birebir korunur. */
export async function squareCanvas(data: Buffer, w: number, h: number, fill: Fill): Promise<Raw> {
  const side = Math.max(w, h);
  if (w === h) return { data, w: side, h: side };
  const dx = Math.floor((side - w) / 2);
  const dy = Math.floor((side - h) / 2);
  const ext = { left: dx, right: side - w - dx, top: dy, bottom: side - h - dy };
  if (fill === "white") return { data: await raw(data, w, h).extend({ ...ext, background: WHITE }).raw().toBuffer(), w: side, h: side };
  const edge = await raw(data, w, h).extend({ ...ext, extendWith: "copy" }).raw().toBuffer();
  if (fill === "none") return { data: edge, w: side, h: side };
  const small = Math.min(side, 320);
  const blurred = await raw(data, w, h).resize(small, small, { fit: "cover" }).blur(Math.max(1, small * 0.05)).resize(side, side).raw().toBuffer();
  const out = Buffer.from(edge);
  const blend = Math.max(2, Math.round(side * BLEND));
  for (let y = 0; y < side; y++) {
    const vy = y < dy ? dy - y : y >= dy + h ? y - (dy + h - 1) : 0;
    for (let x = 0; x < side; x++) {
      const e = vy || (x < dx ? dx - x : x >= dx + w ? x - (dx + w - 1) : 0);
      if (e === 0) continue;
      let t = Math.min(1, e / blend);
      t = t * t * (3 - 2 * t);
      const i = (y * side + x) * 3;
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(edge[i + c] * (1 - t) + blurred[i + c] * t);
    }
  }
  return { data: out, w: side, h: side };
}

async function toWebp(r: Raw, max: number, quality: number): Promise<{ buf: Buffer; w: number; h: number }> {
  const { data, info } = await raw(r.data, r.w, r.h)
    .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
    .webp({ quality, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  return { buf: data, w: info.width, h: info.height };
}

export interface ProcessedImage {
  big: Buffer;
  small: Buffer;
  width: number;
  height: number;
  fill: Fill;
  cropped: boolean;
}

/** Giriş piksel sınırı: 40 MP (≈6300×6300); 80 MP'de ham tampon + kopyalar ~1 GB belleğe çıkabiliyordu (A11). */
export const MAX_INPUT_PIXELS = 40_000_000;

/** Yüklenen görseli işler (EXIF yönü düzeltilir, kare tuval, iki WebP). Bozuk dosyada sharp hata fırlatır. */
export async function processProductImage(input: Buffer): Promise<ProcessedImage> {
  const { data, info } = await sharp(input, { failOn: "none", limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .flatten({ background: WHITE })
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const d = decide(data, W, H);
  const kept = await raw(data, W, H).extract(d.box).raw().toBuffer();
  let src: Raw = { data: kept, w: d.box.width, h: d.box.height };
  if (src.w !== src.h) src = await squareCanvas(src.data, src.w, src.h, d.fill);
  const big = await toWebp(src, BIG_MAX, 82);
  const small = await toWebp(src, SMALL_MAX, 78);
  return { big: big.buf, small: small.buf, width: big.w, height: big.h, fill: d.fill, cropped: d.cropped };
}

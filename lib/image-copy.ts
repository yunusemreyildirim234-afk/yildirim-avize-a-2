// Trendyol görsellerini sunucuda Vercel Blob'a kopyalama: SAF çekirdek (ağ, Blob, veritabanı DIŞARIDAN verilir; testte sahte).
// tools/gorsel ile AYNI Blob yolu ve imageMap biçimi: urun/<productId>/<sha1(url)[0..16]>-kr-v2-{b,k}.webp ve syncSnapshot.imageMap[<Trendyol adresi>] = <-b.webp adresi.
import { createHash } from "node:crypto";
import { imageMapOf } from "./image-map.ts";

/** Bir parti için süre bütçesi (ms) ve en çok görsel denemesi; hangisi önce dolarsa parti biter. */
export const COPY_BUDGET_MS = 25_000;
export const COPY_MAX_IMAGES = 4;
/** Her Trendyol görseli Blob'a iki dosya (-b, -k) yazar. */
export const WRITES_PER_IMAGE = 2;
const TRENDYOL_RE = /^https:\/\/([a-z0-9-]+\.)*dsmcdn\.com\//i;

export const isTrendyolUrl = (u: unknown): u is string => typeof u === "string" && TRENDYOL_RE.test(u);
export const sourceHash = (url: string) => createHash("sha1").update(url).digest("hex").slice(0, 16);
/** tools/gorsel/lib/cekirdek.mjs blobYolu(productId, url, "kare", boyut) ile birebir aynı. */
export const copyPath = (productId: string, url: string, size: "b" | "k") => `urun/${productId}/${sourceHash(url)}-kr-v2-${size}.webp`;

export interface CopyProduct {
  id: string;
  images: string[];
  imageUrl: string | null;
  syncSnapshot: unknown;
  variations: { id: string; images: string[] }[];
}

export interface WritePlan {
  id: string;
  oldImages: string[];
  oldImageUrl: string | null;
  newImages: string[];
  newImageUrl: string | null;
  variations: { id: string; old: string[]; next: string[] }[];
  oldSnapshot: unknown;
  /** Eski imageMap + bu partide eklenenler (Trendyol adresi → -b.webp). */
  imageMap: Record<string, string>;
}

export interface CopyStore {
  /** Tüm ürünler (kararlı sırayla). */
  list(): Promise<CopyProduct[]>;
  /** KOŞULLU yazma: ürün hâlâ plan.old* değerindeyse yazar ve true; arada değişmişse hiçbir şey yazmaz, false. */
  apply(plan: WritePlan): Promise<boolean>;
}

export interface CopyDeps {
  fetchImage(url: string): Promise<Buffer>;
  process(input: Buffer): Promise<{ big: Buffer; small: Buffer }>;
  blob: { put(path: string, data: Buffer): Promise<string> };
  now(): number;
}

export interface CopyError {
  productId: string;
  url: string;
  hata: string;
}

export interface BatchResult {
  kopyalanan: number;
  hatalar: CopyError[];
  /** Okunduktan sonra değiştiği için yazılmayan ürünler (bir sonraki partide yeniden denenir). */
  atlananUrun: string[];
  /** Bu partide denenen Blob yazması (kota tahmini için). */
  yazma: number;
  /** Hâlâ Trendyol adresinde duran tekil görsel sayısı. */
  kalan: number;
  /** Kalanın, istemcinin atla listesi ve bu partinin hataları dışındaki kısmı; 0 ise döngü biter. */
  sirada: number;
}

/** Ürünün (genel + kapak + renk) tekil Trendyol adresleri. */
export function sourcesOf(p: CopyProduct): string[] {
  return [...new Set([...p.images, p.imageUrl, ...p.variations.flatMap((v) => v.images)].filter(isTrendyolUrl))];
}

const distinct = (products: CopyProduct[]) => new Set(products.flatMap(sourcesOf));

/** Kopyalanan adresleri ürüne uygular: görsel listesi, kapak, renkler; imageMap eski kayda eklenir. Değişen yoksa null. */
export function buildWritePlan(p: CopyProduct, copied: Record<string, string>): WritePlan | null {
  const cevir = (x: string) => copied[x] ?? x;
  const newImages = [...new Set(p.images.map(cevir))];
  const newImageUrl = p.imageUrl ? cevir(p.imageUrl) : p.imageUrl;
  const variations = p.variations
    .map((v) => ({ id: v.id, old: v.images, next: [...new Set(v.images.map(cevir))] }))
    .filter((v) => v.old.length !== v.next.length || v.old.some((x, i) => x !== v.next[i]));
  const sameImages = newImages.length === p.images.length && newImages.every((x, i) => x === p.images[i]);
  if (sameImages && newImageUrl === p.imageUrl && variations.length === 0) return null;
  return { id: p.id, oldImages: p.images, oldImageUrl: p.imageUrl, newImages, newImageUrl, variations, oldSnapshot: p.syncSnapshot, imageMap: { ...imageMapOf(p.syncSnapshot), ...copied } };
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Bekleyen görsellerden küçük bir parti kopyalar. Süre bütçesi ya da en çok görsel sayısı dolunca durur.
 * Hata veren görsel (zaman aşımı, bozuk dosya, Blob hatası) atlanır, diğerleri sürer. atla: istemcinin bu koşuda zaten hata aldığı adresler.
 * İdempotent: kopyalanan görsel artık Trendyol adresinde olmadığından sonraki partilerde bir daha işlenmez.
 */
export async function copyBatch(store: CopyStore, deps: CopyDeps, opts: { atla?: ReadonlySet<string>; budgetMs?: number; maxImages?: number } = {}): Promise<BatchResult> {
  const atla = opts.atla ?? new Set<string>();
  const budget = opts.budgetMs ?? COPY_BUDGET_MS;
  const max = opts.maxImages ?? COPY_MAX_IMAGES;
  const start = deps.now();
  const products = await store.list();
  const pendingBefore = distinct(products);
  const hatalar: CopyError[] = [];
  const atlananUrun: string[] = [];
  const written = new Set<string>();
  const failed = new Set<string>();
  let denendi = 0;
  let yazma = 0;
  let dolu = false;

  for (const p of products) {
    if (dolu) break;
    const copied: Record<string, string> = {};
    for (const url of sourcesOf(p)) {
      if (atla.has(url)) continue;
      if (denendi >= max || deps.now() - start >= budget) {
        dolu = true;
        break;
      }
      denendi++;
      try {
        const out = await deps.process(await deps.fetchImage(url));
        yazma++;
        await deps.blob.put(copyPath(p.id, url, "k"), out.small);
        yazma++;
        copied[url] = await deps.blob.put(copyPath(p.id, url, "b"), out.big);
      } catch (e) {
        failed.add(url);
        hatalar.push({ productId: p.id, url, hata: msg(e) });
      }
    }
    const plan = Object.keys(copied).length > 0 ? buildWritePlan(p, copied) : null;
    if (!plan) continue;
    let ok = false;
    try {
      ok = await store.apply(plan);
    } catch (e) {
      for (const url of Object.keys(copied)) hatalar.push({ productId: p.id, url, hata: `veritabanına yazılamadı: ${msg(e)}` });
      for (const url of Object.keys(copied)) failed.add(url);
      continue;
    }
    if (ok) for (const url of Object.keys(copied)) written.add(url);
    else atlananUrun.push(p.id);
  }

  const kalanSet = [...pendingBefore].filter((u) => !written.has(u));
  const kalanFiltre = kalanSet.filter((u) => !atla.has(u) && !failed.has(u));
  return { kopyalanan: written.size, hatalar, atlananUrun, yazma, kalan: kalanSet.length, sirada: kalanFiltre.length };
}

/** Yalnızca Trendyol (dsmcdn) adreslerinden, 12 sn zaman aşımı ve boyut sınırıyla indirir (SSRF'e karşı başka adres kabul edilmez).
 *  Yönlendirme izlenmez (`redirect: "error"`): varılan adres denetlenemeyeceği için dsmcdn dışına çıkış kapalıdır.
 *  Gövde akışla okunur; başlık yoksa/yanlışsa bile sınır aşılınca kesilir (tamamı belleğe alınmaz). */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export async function fetchTrendyolImage(url: string, fetcher: typeof fetch = fetch): Promise<Buffer> {
  if (!isTrendyolUrl(url)) throw new Error("Trendyol adresi değil.");
  const res = await fetcher(url, { signal: AbortSignal.timeout(12_000), redirect: "error" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!(res.headers.get("content-type") ?? "").startsWith("image/")) throw new Error("görsel değil");
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_SOURCE_BYTES) throw new Error("dosya çok büyük");
  if (!res.body) throw new Error("dosya boyutu uygun değil");
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error("dosya çok büyük");
    }
    chunks.push(value);
  }
  if (total === 0) throw new Error("dosya boyutu uygun değil");
  return Buffer.concat(chunks, total);
}

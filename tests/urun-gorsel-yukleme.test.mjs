import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { storeProductImage, sniffImage, blobBasePath, MAX_ADMIN_IMAGE_BYTES } from "../lib/product-image-store.ts";

const solid = (w, h, bg) => sharp({ create: { width: w, height: h, channels: 3, background: bg } }).jpeg().toBuffer();
const asFile = (buf, name = "a.jpg") => new File([buf], name);
const RED = { r: 200, g: 30, b: 30 };
const capture = () => {
  const files = new Map();
  return {
    files,
    async put(p, d) {
      files.set(p, d);
      return `https://x.public.blob.vercel-storage.com/${p}`;
    },
  };
};
const failing = (suffix) => {
  const calls = [];
  return {
    calls,
    async put(p) {
      if (p.endsWith(suffix)) throw new Error("boom");
      calls.push(p);
      return `https://x.public.blob.vercel-storage.com/${p}`;
    },
  };
};
const big = (b) => b.files.get([...b.files.keys()].find((p) => p.endsWith("-b.webp")));
const small = (b) => b.files.get([...b.files.keys()].find((p) => p.endsWith("-k.webp")));

test("kare görsel: -k ve -b birlikte, belirlenimci yol, kare çıktı", async () => {
  const b = capture();
  const r = await storeProductImage(asFile(await solid(1000, 1000, RED)), "prod12345", b);
  assert.ok(r.ok);
  assert.equal(b.files.size, 2);
  assert.match(r.url, /\/urun\/prod12345\/[0-9a-f]{40}-b\.webp$/);
  assert.equal(r.smallUrl, r.url.replace(/-b\.webp$/, "-k.webp"));
  const mb = await sharp(big(b)).metadata();
  const mk = await sharp(small(b)).metadata();
  assert.deepEqual([mb.width, mb.height, mb.format], [1000, 1000, "webp"]);
  assert.deepEqual([mk.width, mk.height], [800, 800]);
  const again = await storeProductImage(asFile(await solid(1000, 1000, RED)), "prod12345", capture());
  assert.equal(again.url, r.url, "aynı içerik aynı yol");
});

test("dikey ve yatay: kare tuval, büyük sürüm en çok 1600", async () => {
  for (const [w, h] of [[600, 1200], [2400, 1200]]) {
    const b = capture();
    const r = await storeProductImage(asFile(await solid(w, h, RED)), null, b);
    assert.ok(r.ok);
    assert.match(r.url, /\/urun\/yeni\//);
    const m = await sharp(big(b)).metadata();
    assert.equal(m.width, m.height);
    assert.equal(m.width, Math.min(1600, Math.max(w, h)));
  }
});

test("beyaz zeminli yatay görsel: beyaz dolgu; renkli: bulanık (köşe renge yakın)", async () => {
  const corner = async (bg) => {
    const b = capture();
    await storeProductImage(asFile(await solid(1200, 600, bg)), "prod12345", b);
    const { data } = await sharp(big(b)).raw().toBuffer({ resolveWithObject: true });
    return [data[0], data[1], data[2]];
  };
  assert.ok((await corner({ r: 255, g: 255, b: 255 })).every((v) => v >= 250));
  const c = await corner(RED);
  assert.ok(c[0] > 150 && c[1] < 90, `kırmızıya yakın dolgu beklenir: ${c}`);
});

test("EXIF yönü düzeltilir (orientation 6: 600x300 → 300x600 → kare 600)", async () => {
  const src = await sharp({ create: { width: 600, height: 300, channels: 3, background: RED } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const b = capture();
  assert.ok((await storeProductImage(asFile(src), "prod12345", b)).ok);
  const m = await sharp(big(b)).metadata();
  assert.deepEqual([m.width, m.height], [600, 600]);
});

test("SVG, metin ve PDF reddedilir; depoya yazılmaz", async () => {
  const b = capture();
  for (const body of ['<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>', "merhaba", "%PDF-1.4"]) {
    const r = await storeProductImage(asFile(Buffer.from(body), "x.png"), "prod12345", b);
    assert.equal(r.ok, false);
    assert.equal(r.status, 400);
  }
  assert.equal(b.files.size, 0);
  assert.equal(sniffImage(Buffer.from("<svg")), null);
});

test("AVIF kabul edilir (sihirli bayt)", async () => {
  const avif = await sharp({ create: { width: 64, height: 64, channels: 3, background: RED } }).avif().toBuffer();
  assert.equal(sniffImage(avif), "image/avif");
  assert.ok((await storeProductImage(asFile(avif, "a.avif"), "prod12345", capture())).ok);
});

test("büyük dosya (>4 MB): 413 ve anlaşılır hata, depoya yazılmaz", async () => {
  const f = failing("never");
  const r = await storeProductImage(asFile(Buffer.alloc(MAX_ADMIN_IMAGE_BYTES + 1, 0xff)), "prod12345", f);
  assert.equal(r.ok, false);
  assert.equal(r.status, 413);
  assert.match(r.error, /4 MB/);
  assert.equal(f.calls.length, 0);
});

test("iki dosyadan biri başarısızsa hata döner, URL dönmez", async () => {
  for (const suffix of ["-k.webp", "-b.webp"]) {
    const r = await storeProductImage(asFile(await solid(500, 500, RED)), "prod12345", failing(suffix));
    assert.equal(r.ok, false);
    assert.equal(r.status, 502);
    assert.match(r.error, /Blob/);
    assert.equal(r.url, undefined);
  }
});

test("bozuk görsel: net hata", async () => {
  const bad = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(50, 1)]);
  const r = await storeProductImage(asFile(bad), "prod12345", capture());
  assert.equal(r.ok, false);
  assert.match(r.error, /okunamadı/);
});

test("blobBasePath: geçersiz ürün kimliği 'yeni' klasörüne gider", () => {
  assert.equal(blobBasePath("../x", "abc"), "urun/yeni/abc");
  assert.equal(blobBasePath("cm123456789", "abc"), "urun/cm123456789/abc");
});

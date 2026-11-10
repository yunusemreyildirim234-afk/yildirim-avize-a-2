import test from "node:test";
import assert from "node:assert/strict";
import { countUncopiedImages, imageSrcSet, isBlobImage, smallImage } from "../lib/img.ts";

const B = "https://abc123.public.blob.vercel-storage.com/urun/p1/0123456789ab-kr-b.webp";
const K = "https://abc123.public.blob.vercel-storage.com/urun/p1/0123456789ab-kr-k.webp";
const T = "https://cdn.dsmcdn.com/ty1/urun-b.webp";
const U = "/api/product-images/11111111-1111-1111-1111-111111111111";

test("isBlobImage: yalnızca herkese açık Vercel Blob adresleri", () => {
  assert.equal(isBlobImage(B), true);
  for (const u of [T, U, null, undefined, "", "https://evil.example/x.public.blob.vercel-storage.com/a-b.webp", "http://abc.public.blob.vercel-storage.com/a-b.webp"]) assert.equal(isBlobImage(u), false);
});

test("smallImage: kopyalanmış görselde -k, diğer her adres (ve boş değer) aynen", () => {
  assert.equal(smallImage(B), K);
  assert.equal(smallImage(K), K);
  assert.equal(smallImage(T), T); // Trendyol adresi "-b.webp" ile bitse bile değişmez
  assert.equal(smallImage(U), U);
  assert.equal(smallImage(null), null);
  assert.equal(smallImage(undefined), undefined);
  assert.equal(smallImage("https://abc.public.blob.vercel-storage.com/baska.png"), "https://abc.public.blob.vercel-storage.com/baska.png");
});

test("imageSrcSet: yalnızca kopyalanmış görselde 800w/1600w", () => {
  assert.equal(imageSrcSet(B), `${K} 800w, ${B} 1600w`);
  assert.equal(imageSrcSet(T), undefined);
  assert.equal(imageSrcSet(null), undefined);
});

test("countUncopiedImages: tekil Trendyol adreslerini sayar; Blob ve yüklenmiş görseller sayılmaz", () => {
  assert.equal(countUncopiedImages([[T, B, U, null], [T, "https://img-x.dsmcdn.com/a.jpg"], []]), 2);
  assert.equal(countUncopiedImages([[B, U]]), 0);
});

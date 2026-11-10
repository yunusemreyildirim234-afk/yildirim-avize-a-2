import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { replaceAt, downloadBaseName } from "../lib/image-list.ts";
import { MAX_EDIT_IMAGES, parseImageUrls } from "../lib/variation-input.ts";

const rd = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const urls = (n) => Array.from({ length: n }, (_, i) => (i % 2 ? `https://cdn.dsmcdn.com/ty/${i}.jpg` : `https://abc.public.blob.vercel-storage.com/urun/p1/h${i}-b.webp`));

test("Değiştir sırayı korur: yalnızca hedef öğe değişir", () => {
  const list = [{ key: "a", src: "1" }, { key: "b", src: "2" }, { key: "c", src: "3" }];
  const out = replaceAt(list, 1, { key: "b", src: "yeni" });
  assert.deepEqual(out.map((x) => x.src), ["1", "yeni", "3"]);
  assert.deepEqual(out.map((x) => x.key), ["a", "b", "c"]);
  assert.deepEqual(list.map((x) => x.src), ["1", "2", "3"], "özgün liste değişmez");
  assert.deepEqual(replaceAt(list, 9, { key: "z", src: "z" }), list, "geçersiz sıra listeyi bozmaz");
  assert.equal(replaceAt(list, 0, { key: "a", src: "k" })[0].src, "k", "kapak yerinde kalır");
});

test("indirme adı: ürün adı + sıra", () => {
  assert.equal(downloadBaseName("Kristal Sarkıt Avize", 0), "kristal-sarkıt-avize-1");
  assert.equal(downloadBaseName("  ", 4), "urun-5");
});

test("23 görselli ürün düzenlenince görsel kaybolmaz (sınır 30)", () => {
  assert.equal(MAX_EDIT_IMAGES, 30);
  const r = parseImageUrls(urls(23), MAX_EDIT_IMAGES, "Ürün fotoğrafları");
  assert.ok(r.ok);
  assert.equal(r.value.length, 23);
  assert.ok(parseImageUrls(urls(30), MAX_EDIT_IMAGES, "x").ok);
  assert.equal(parseImageUrls(urls(31), MAX_EDIT_IMAGES, "x").ok, false);
  assert.equal(parseImageUrls(urls(23), 20, "x").ok, false, "eski sınır 23'ü reddederdi");
});

test("düzenleme ucu ve admin-undo sınırı 30 (20 kalmadı)", () => {
  const route = rd("../app/api/admin/product/route.ts");
  assert.match(route, /parseImageUrls\(body\.images, MAX_EDIT_IMAGES,/);
  assert.doesNotMatch(route, /parseImageUrls\(body\.images, 20/);
  const undo = rd("../lib/admin-undo.ts");
  assert.match(undo, /v\.length > MAX_EDIT_IMAGES\) return bad\("images"\)/);
  assert.doesNotMatch(undo, /v\.length > 20\) return bad\("images"\)/);
  const editor = rd("../components/AdminProductEditor.tsx");
  assert.doesNotMatch(editor, /max=\{20\}/);
});

test("yükleme ucu Neon'a düşmez: productImage.create yok, token yoksa 503", () => {
  const route = rd("../app/api/admin/product-images/route.ts");
  assert.doesNotMatch(route, /productImage\.create/);
  assert.match(route, /status: 503/);
});

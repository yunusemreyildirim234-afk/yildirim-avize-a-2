import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { categorySeo } from "../lib/category-seo.ts";

test("sabit kategoriler tablodaki başlığı verir; açıklama ≤160", () => {
  for (const s of ["kristal", "modern", "klasik", "sarkit", "aksesuar", "tum", "cok-satanlar", "indirimli", "one-cikanlar"]) {
    const r = categorySeo(s, "x");
    assert.ok(r.title.length > 0 && r.desc.length <= 160, s);
  }
  assert.equal(categorySeo("kristal", "Kristal Serisi").title, "Kristal Avize Modelleri ve Fiyatları");
  assert.doesNotMatch(categorySeo("aksesuar", "x").desc, /Montajlı/);
});

test("dinamik ve yeniden adlandırılmış kategori: '{Ad} Modelleri ve Fiyatları'", () => {
  assert.equal(categorySeo("yemek-masasi", "Yemek Masası Üstü Avizeler").title, "Yemek Masası Üstü Avizeler Modelleri ve Fiyatları");
  assert.equal(categorySeo("kristal", "Işıltı", true).title, "Işıltı Modelleri ve Fiyatları");
});

test("sayfa: h1 görünen adı değişmez, <title> seo başlığı", () => {
  const s = readFileSync(new URL("../app/kategori/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(s, /<h1[^>]*>\{current\.title\}<\/h1>/);
  assert.match(s, /title: page > 1 \? `\$\{seoTitle\} - Sayfa/);
});

import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { productPath, productSlug, parseProductParam } = await import("../lib/product-url.ts");

const ID = "3f9a1c2e-5b7d-4e1a-9c3f-0a1b2c3d4e5f";

test("Türkçe karakterli başlık okunur adres olur, kısa kimlik sonda", () => {
  assert.equal(productPath({ id: ID, title: "Kristal Avize 6 Lı Şık Çiçek" }), "/urun/kristal-avize-6-li-sik-cicek-3f9a1c2e");
  assert.equal(productPath({ id: ID, title: "Kontes Gold (TAM MONTAJLIDIR.)" }), "/urun/kontes-gold-3f9a1c2e");
});

test("boş başlık eski uuid adresine düşer; simge-yalnız başlık 'urun' olur", () => {
  assert.equal(productPath({ id: ID, title: "" }), `/urun/${ID}`);
  assert.equal(productPath({ id: ID }), `/urun/${ID}`);
  assert.equal(productPath({ id: ID, title: "★★★" }), "/urun/urun-3f9a1c2e");
  assert.equal(productSlug("Kategori Avize"), "kategori-avize");
});

test("çok uzun başlık 60 karakterde kesilir, sonda tire kalmaz", () => {
  const p = productPath({ id: ID, title: "Kristal ".repeat(40) });
  const slug = p.slice("/urun/".length, -"-3f9a1c2e".length);
  assert.ok(slug.length <= 60);
  assert.ok(!slug.endsWith("-"));
});

test("ayrıştırma: uuid, slug+kısa, çıplak kısa, bozuk, büyük harf, javascript:", () => {
  assert.deepEqual(parseProductParam(ID), { kind: "legacy-uuid", id: ID });
  assert.deepEqual(parseProductParam(ID.toUpperCase()), { kind: "legacy-uuid", id: ID });
  assert.deepEqual(parseProductParam("kristal-avize-3f9a1c2e"), { kind: "short", short: "3f9a1c2e" });
  assert.deepEqual(parseProductParam("KRISTAL-AVIZE-3F9A1C2E"), { kind: "short", short: "3f9a1c2e" });
  assert.deepEqual(parseProductParam("3f9a1c2e"), { kind: "short", short: "3f9a1c2e" });
  for (const bad of ["", "kristal-avize", "kristal-3f9a1c2", "javascript:alert(1)", "a/b-3f9a1c2e", "%E0%A4%A", "x".repeat(300), "kristal avize-3f9a1c2e", "-"]) {
    assert.deepEqual(parseProductParam(bad), { kind: "bad" }, bad);
  }
});

test("gidiş-dönüş: productPath çıktısı aynı ürüne çözülür", () => {
  const t = "Modern Kristal Salon Avizesi Gri";
  const path = productPath({ id: ID, title: t }).slice("/urun/".length);
  assert.deepEqual(parseProductParam(path), { kind: "short", short: ID.slice(0, 8) });
  assert.deepEqual(parseProductParam(encodeURIComponent(path)), { kind: "short", short: ID.slice(0, 8) });
});

test("236 gerçekçi kimlikte kısa kimlik çakışması yok", () => {
  const seen = new Set();
  for (let i = 0; i < 236; i++) seen.add(crypto.randomUUID().slice(0, 8));
  assert.equal(seen.size, 236);
});

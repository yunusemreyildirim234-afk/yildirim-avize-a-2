import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { parseSettings } = await import("../lib/trendyol-sync.ts");
const { GROUPS } = await import("../lib/trendyol-plan.ts");

const hepsi = (m) => Object.fromEntries(GROUPS.map((g) => [g, m]));

test("boş/bozuk girdi: her grup KEEP (elle değiştirilenleri koruyan güvenli mod)", () => {
  for (const raw of [null, undefined, "x", 5, true, [], {}, () => 1]) assert.deepEqual(parseSettings(raw), hepsi("KEEP"), String(raw));
});

test("geçerli değerler korunur; eksik gruplar KEEP olur", () => {
  const r = parseSettings({ STOCK: "OVERWRITE", PRICE: "SKIP" });
  assert.equal(r.STOCK, "OVERWRITE");
  assert.equal(r.PRICE, "SKIP");
  for (const g of GROUPS.filter((x) => x !== "STOCK" && x !== "PRICE")) assert.equal(r[g], "KEEP", g);
});

test("geçersiz değerler (küçük harf, boşluk, sayı, nesne) ÜZERİNE YAZ'a dönüşmez, KEEP olur", () => {
  const r = parseSettings({ STOCK: "overwrite", PRICE: " OVERWRITE", TEXT: 1, IMAGES: {}, CATEGORY: ["OVERWRITE"], VARIANT_INFO: null, ACTIVE: "EZ" });
  assert.deepEqual(r, hepsi("KEEP"));
});

test("bilinmeyen anahtarlar ve prototip anahtarları sonuca sızmaz", () => {
  const r = parseSettings(JSON.parse('{"EXTRA":"OVERWRITE","__proto__":{"STOCK":"OVERWRITE"},"constructor":"SKIP"}'));
  assert.deepEqual(Object.keys(r).sort(), [...GROUPS].sort());
  assert.equal(r.STOCK, "KEEP");
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const block = (s, name) => s.slice(s.indexOf(`const ${name} =`), s.indexOf("satisfies"));
const used = (s, re) => new Set([...s.matchAll(re)].map((m) => m[1]));

test("sepet GET: include yok, yanıtta kullanılan her ürün/varyasyon alanı dar select'te var", () => {
  const s = read("app/api/cart/route.ts");
  assert.doesNotMatch(s.slice(0, s.indexOf("export async function PUT")), /include:/);
  const sel = block(s, "CART_SELECT");
  const get = s.slice(s.indexOf("export async function GET"), s.indexOf("export async function PUT"));
  for (const f of used(get, /r\.variation\.product\.(\w+)/g)) assert.match(sel, new RegExp(`${f}:`), `product.${f}`);
  for (const f of used(get, /r\.variation\.(?!product)(\w+)/g)) assert.match(sel, new RegExp(`${f}:`), `variation.${f}`);
  for (const f of used(get, /r\.(?!variation\b)(\w+)/g)) assert.match(sel, new RegExp(`${f}:`), `row.${f}`);
  // kapak ve kademe yardımcıları için gereken alanlar
  for (const f of ["images", "imageUrl", "bulkTiers", "couponAllowed", "pickupDiscountPct", "transferDiscountPct"]) assert.match(sel, new RegExp(`${f}:`), f);
  assert.doesNotMatch(sel, /description|syncSnapshot|trendyol/i);
});

test("favori GET: include yok, kullanılan alanlar select'te", () => {
  const s = read("app/api/favorites/route.ts");
  assert.doesNotMatch(s.slice(0, s.indexOf("export async function PUT")), /include:/);
  const sel = block(s, "FAVORITE_SELECT");
  const get = s.slice(s.indexOf("export async function GET"), s.indexOf("export async function PUT"));
  for (const f of used(get, /r\.product\.(\w+)/g)) assert.match(sel, new RegExp(`${f}:`), `product.${f}`);
  assert.match(sel, /\bimages\b/);
  assert.match(sel, /\bimageUrl\b/);
  assert.doesNotMatch(sel, /description|syncSnapshot|trendyol/i);
});

test("yanıt biçimi aynı: sepet ve favori öğe alanları korunur", () => {
  const c = read("app/api/cart/route.ts");
  for (const k of ["productId", "variationId", "title", "imageUrl", "variationName", "price", "listPrice", "bulk", "rules", "quantity"]) assert.match(c, new RegExp(`${k}:`), k);
  const f = read("app/api/favorites/route.ts");
  for (const k of ["id", "title", "category", "basePrice", "imageUrl"]) assert.match(f, new RegExp(`${k}:`), k);
});

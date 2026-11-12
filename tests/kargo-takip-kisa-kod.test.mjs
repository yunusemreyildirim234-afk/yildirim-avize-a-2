import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isShortOrderCode, pickVerifiedOrder } from "../lib/order-lookup.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const o = (id, email) => ({ id, email });

test("kısa kod biçimi: tam 8 onaltılık hane", () => {
  assert.equal(isShortOrderCode("1a2b3c4d"), true);
  assert.equal(isShortOrderCode(" 1A2B3C4D "), true);
  assert.equal(isShortOrderCode("1a2b3c4"), false);
  assert.equal(isShortOrderCode("YA-1A2B3C4D"), false); // barkod mevcut tam eşleşme yolunda
  assert.equal(isShortOrderCode("1234567890"), false); // takip kodu
  assert.equal(isShortOrderCode("1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"), false); // tam kimlik
});

test("eşleşme: e-posta büyük/küçük harf ve boşluk duyarsız; misafir etiketi temizlenir", () => {
  const c = [o("id-1", "ali+misafirx9@example.com")];
  assert.equal(pickVerifiedOrder(c, "  ALI@Example.com ")?.id, "id-1");
});

test("yanlış e-posta, boş e-posta ve @ olmayan girdi → null", () => {
  const c = [o("id-1", "ali@example.com")];
  assert.equal(pickVerifiedOrder(c, "veli@example.com"), null);
  assert.equal(pickVerifiedOrder(c, ""), null);
  assert.equal(pickVerifiedOrder(c, "ali"), null);
});

test("çakışma: aynı önekli iki siparişten yalnızca e-postası eşleşen seçilir; ikisi de eşleşirse null", () => {
  assert.equal(pickVerifiedOrder([o("a", "ali@example.com"), o("b", "veli@example.com")], "veli@example.com")?.id, "b");
  assert.equal(pickVerifiedOrder([o("a", "ali@example.com"), o("b", "ali@example.com")], "ali@example.com"), null);
  assert.equal(pickVerifiedOrder([], "ali@example.com"), null);
});

test("eylem: hız sınırı, ikinci doğrulama; e-posta adrese yazılmaz; hata iletisi genel", () => {
  const a = read("../app/kargo-takip/actions.ts");
  assert.match(a, /^"use server"/);
  assert.ok(a.includes('rateLimit('));
  assert.ok(a.includes("pickVerifiedOrder"));
  assert.ok(!/redirect\([^)]*\$\{email\}/.test(a) && !/encodeURIComponent\(email\)/.test(a));
  assert.ok(a.includes("take: 5"));
});

test("sayfa: mevcut tam kimlik / takip kodu / barkod sorgusu ve hız sınırı korunur", () => {
  const p = read("../app/kargo-takip/page.tsx");
  assert.match(p, /OR: \[\{ id: code \}, \{ shippingTrackingCode: code \}, \{ shippingBarcode: code \}\]/);
  assert.ok(p.includes('"kargo-takip", 20, 10 * 60_000'));
  assert.ok(p.includes("action={trackOrder}"));
  assert.ok(!p.includes("email: true")); // e-posta sonuçta istemciye gitmez
});

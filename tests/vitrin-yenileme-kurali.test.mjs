import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STOREFRONT_UNCHANGED, STOREFRONT_UNCHANGED_HEADER, shouldRevalidate, statusChangeTouchesStorefront } from "../lib/revalidate-rule.ts";
import { planStatusChange } from "../lib/order-undo.ts";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const res = (status, headers = {}) => new Response("{}", { status, headers });

test("yenileme kararı: 2xx yeniler; hata ve 'değişmedi' işaretli yanıt yenilemez", () => {
  assert.equal(shouldRevalidate(res(200)), true);
  assert.equal(shouldRevalidate(res(201)), true);
  assert.equal(shouldRevalidate(res(400)), false);
  assert.equal(shouldRevalidate(res(409)), false);
  assert.equal(shouldRevalidate(res(500)), false);
  assert.equal(shouldRevalidate(res(200, STOREFRONT_UNCHANGED.headers)), false);
  assert.equal(shouldRevalidate(res(200, { [STOREFRONT_UNCHANGED_HEADER]: "0" })), true);
});

test("sipariş durumu: stok oynamayan geçişler vitrini yenilemez; iptal/iade/başarısız ve yeniden açma yeniler", () => {
  const touches = (from, to, deducted) => statusChangeTouchesStorefront(planStatusChange(from, to, deducted));
  for (const [from, to] of [["PENDING", "SHIPPED"], ["SHIPPED", "DELIVERED"], ["PENDING", "READY_FOR_PICKUP"], ["READY_FOR_PICKUP", "DELIVERED"], ["PENDING_NEW", "PENDING"]]) {
    assert.equal(touches(from, to, true), false, `${from} → ${to}`);
  }
  for (const [from, to] of [["PENDING", "CANCELLED"], ["DELIVERED", "RETURNED"], ["AWAITING_PAYMENT", "PAYMENT_FAILED"]]) {
    assert.equal(touches(from, to, true), true, `${from} → ${to} (stok iade)`);
  }
  assert.equal(touches("CANCELLED", "PENDING", false), true, "yeniden açma stok düşer");
  assert.equal(touches("PENDING", "CANCELLED", false), false, "stok hiç düşülmemişse iade de yok");
});

test("sarmalayıcı kuralı kullanır; vitrini değiştiren uçlar sarmalı kalır", () => {
  const rev = src("lib/revalidate.ts");
  assert.match(rev, /if \(shouldRevalidate\(res\)\) revalidateStorefront\(\);/);
  for (const p of ["product/route.ts", "product/bulk/route.ts", "product/variation/route.ts", "undo/route.ts", "orders/route.ts", "coupons/route.ts", "reviews/route.ts", "homepage/route.ts", "categories/route.ts", "order-status/route.ts", "order-status/undo/route.ts", "order-request/route.ts"]) {
    assert.match(src(`app/api/admin/${p}`), /withStorefrontRevalidate\(/, p);
  }
});

test("vitrini değiştirmeyen işlemler işaretli: açıklama, stoksuz durum geçişi, reddedilen talep, havale onayı", () => {
  const product = src("app/api/admin/product/route.ts");
  const desc = product.slice(product.indexOf('"description" in body'), product.indexOf("// Tekil ürün düzenleme"));
  assert.match(desc, /\{ success: true, description: description\.value \}, STOREFRONT_UNCHANGED\)/);
  // stok / fiyat / görsel yazan dallar işaretsiz kalır
  const rest = product.slice(product.indexOf("// Tekil ürün düzenleme"));
  assert.ok(!/STOREFRONT_UNCHANGED/.test(rest));
  assert.match(src("app/api/admin/order-status/route.ts"), /statusChangeTouchesStorefront\(plan\) \? undefined : STOREFRONT_UNCHANGED\)/);
  assert.match(src("app/api/admin/order-status/undo/route.ts"), /t\.restoredStock === true \? undefined : STOREFRONT_UNCHANGED\)/);
  assert.match(src("app/api/admin/order-request/route.ts"), /approve \? undefined : STOREFRONT_UNCHANGED\)/);
  const confirm = src("app/api/admin/orders/confirm-payment/route.ts");
  assert.ok(!/withStorefrontRevalidate/.test(confirm));
  // eski (rezervesiz) kayıtta stok düşerse çekirdek kendisi yeniler
  assert.match(src("lib/orders.ts"), /if \(stockChanged\) revalidateStorefrontSafe\(\);/);
});

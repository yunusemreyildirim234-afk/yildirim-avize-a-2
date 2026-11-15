import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withStoredNames } from "../lib/order-display.ts";

const live = { variation: { id: "v", variationValue: "Krom", product: { id: "p", title: "Yeni Ad" } } };

test("saklı ad/renk varsa görünen ad onunla değişir", () => {
  const r = withStoredNames({ ...live, productTitle: "Eski Ad", variationLabel: "Gold" });
  assert.equal(r.variation.product.title, "Eski Ad");
  assert.equal(r.variation.variationValue, "Gold");
  assert.equal(r.variation.product.id, "p");
});

test("eski siparişte (NULL) canlı kayıt kalır", () => {
  const r = withStoredNames({ ...live, productTitle: null, variationLabel: null });
  assert.equal(r.variation.product.title, "Yeni Ad");
  assert.equal(r.variation.variationValue, "Krom");
});

test("sipariş kaydı kalem adlarını yazar, stok satırları etkilenmez", () => {
  const src = readFileSync(new URL("../app/api/order/route.ts", import.meta.url), "utf8");
  assert.match(src, /productTitle: l\.variation\.product\.title, variationLabel: l\.variation\.variationValue/);
  assert.match(src, /mergeByVariation\(itemRows\)/);
});

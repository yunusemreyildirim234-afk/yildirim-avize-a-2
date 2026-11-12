import test from "node:test";
import assert from "node:assert/strict";
import { pickDefaultOption } from "../lib/default-variation.ts";

const v = (id, extraPrice, stock) => ({ id, extraPrice, stock });
// Kart fiyatı = basePrice; sayfa fiyatı = basePrice + seçilenin ek fiyatı
const pagePrice = (base, picked) => base + (picked?.extraPrice ?? 0);

test("ek fiyatlı ilk sırada, ek fiyatsız sonda → ek fiyatsız seçilir; sayfa fiyatı kart fiyatına eşit", () => {
  const list = [v("a", 1000, 5), v("b", 0, 3)];
  const picked = pickDefaultOption(list);
  assert.equal(picked.id, "b");
  assert.equal(pagePrice(8999, picked), 8999);
});

test("ek fiyatsız seçenek stoksuz → stoklu en ucuz ek fiyatlı seçilir", () => {
  const picked = pickDefaultOption([v("a", 0, 0), v("b", 1000, 2), v("c", 500, 1)]);
  assert.equal(picked.id, "c");
});

test("eşit ek fiyatta ilk stoklu seçilir", () => {
  assert.equal(pickDefaultOption([v("a", 0, 0), v("b", 0, 4), v("c", 0, 9)]).id, "b");
});

test("hepsi ek fiyatsız ve stoklu → ilki", () => {
  assert.equal(pickDefaultOption([v("a", 0, 1), v("b", 0, 1)]).id, "a");
});

test("tümü stoksuz → ek fiyatı en düşük (eşitte ilki); boş liste → null", () => {
  assert.equal(pickDefaultOption([v("a", 700, 0), v("b", 0, 0), v("c", 0, 0)]).id, "b");
  assert.equal(pickDefaultOption([]), null);
});

test("negatif stok stoksuz sayılır", () => {
  assert.equal(pickDefaultOption([v("a", 0, -1), v("b", 300, 1)]).id, "b");
});

// Feed / JSON-LD (defaultOffer) sayfanın varsayılan seçeneğinin fiyatını verir
import { defaultOffer } from "../lib/feed.ts";

test("defaultOffer: fiyat = taban + pickDefaultOption ek fiyatı (ek fiyatlı seçenek ilk sırada olsa da)", () => {
  const p = { basePrice: 8999, listPrice: 9999, variations: [v("a", 1000, 5), v("b", 0, 3)] };
  const picked = pickDefaultOption(p.variations);
  const offer = defaultOffer(p);
  assert.equal(offer.variation.id, picked.id);
  assert.equal(offer.price, p.basePrice + picked.extraPrice);
  assert.equal(offer.price, 8999);
  assert.equal(offer.list, 9999);
  assert.equal(offer.inStock, true);
});

test("defaultOffer: ek fiyatsız seçenek stoksuzsa stoklu en ucuz; tümü stoksuzsa en ucuz ve inStock=false", () => {
  assert.equal(defaultOffer({ basePrice: 100, listPrice: null, variations: [v("a", 0, 0), v("b", 50, 1), v("c", 20, 2)] }).price, 120);
  const out = defaultOffer({ basePrice: 100, listPrice: null, variations: [v("a", 50, 0), v("b", 0, 0)] });
  assert.equal(out.price, 100);
  assert.equal(out.inStock, false);
});

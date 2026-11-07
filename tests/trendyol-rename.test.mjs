import test from "node:test";
import assert from "node:assert/strict";
import { planSync } from "../lib/trendyol-plan.ts";

// Belgeleyici test: elle yeniden adlandırılmış varyasyon (AYNI barkod) eşitlemede nasıl davranır. trendyol-plan.ts'e dokunulmaz.
const SNAP = { variationValue: "Bej / 45 x 25" }; // son uygulanan Trendyol değeri
const existing = (value) => [{
  id: "p1", trendyolMainId: "M1", title: "T", description: null, category: "K", basePrice: 100, listPrice: null, images: [], active: true, brand: null, trendyolCategory: null, trendyolUrl: null, syncSnapshot: null,
  variations: [{ id: "v1", barcode: "BARKOD-1", variationValue: value, extraPrice: 0, stock: 5, stockCode: null, salePrice: null, listPrice: null, syncStock: 5, syncSnapshot: { ...SNAP } }],
}];
const incoming = () => [{
  mainId: "M1", title: "T", description: null, category: "K", basePrice: 100, listPrice: null, images: [], active: true, brand: null, trendyolCategory: null, trendyolUrl: null,
  variations: [{ barcode: "BARKOD-1", variationValue: "Bej / 45 x 25", extraPrice: 0, stock: 5, stockCode: null, salePrice: 100, listPrice: null }],
}];
const settings = (mode) => ({ STOCK: "SKIP", PRICE: "SKIP", TEXT: "SKIP", IMAGES: "SKIP", CATEGORY: "SKIP", VARIANT_INFO: mode, ACTIVE: "SKIP" });
const nameChange = (plan) => plan.products[0].variations[0].fields.find((f) => f.alan === "variationValue");
const renamed = "Gold / 45 x 25";

test("Dokunma: elle yeniden adlandırılan varyasyon korunur (yazılacak ad yok)", () => {
  const plan = planSync(existing(renamed), incoming(), settings("SKIP"), {});
  assert.equal(nameChange(plan).karar, "ATLANDI");
  assert.equal(plan.products[0].variations[0].write?.data.variationValue, undefined);
});

test("Elle koru: elle yeniden adlandırılan varyasyon korunur", () => {
  const plan = planSync(existing(renamed), incoming(), settings("KEEP"), {});
  const c = nameChange(plan);
  assert.equal(c.karar, "KORUNACAK");
  assert.equal(c.elleDegisti, true);
  assert.equal(plan.products[0].variations[0].write?.data.variationValue, undefined);
});

test("Ezerek: yeniden adlandırılan varyasyon Trendyol'daki hâline geri ezilir", () => {
  const plan = planSync(existing(renamed), incoming(), settings("OVERWRITE"), {});
  assert.equal(nameChange(plan).karar, "EZİLECEK");
  assert.equal(plan.products[0].variations[0].write.data.variationValue, "Bej / 45 x 25");
});

test("barkod eşleştirmesi: ad değişse de aynı varyasyon bulunur, yeni varyasyon açılmaz, barkod yazılmaz", () => {
  for (const mode of ["SKIP", "KEEP", "OVERWRITE"]) {
    const plan = planSync(existing(renamed), incoming(), settings(mode), {});
    const v = plan.products[0].variations[0];
    assert.equal(v.id, "v1", mode);
    assert.equal(v.yeni, false, mode);
    assert.equal(plan.sayac.yeniVaryasyon, 0, mode);
    assert.equal(v.write?.data.barcode, undefined, mode);
  }
});

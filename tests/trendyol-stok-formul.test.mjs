import test from "node:test";
import assert from "node:assert/strict";
import { stockDecision, planSync, GROUPS } from "../lib/trendyol-plan.ts";

// MEVCUT davranışı tanımlar (LIB-02: formül bilerek değiştirilmedi). Düzeltme beklentisi YAZILMAZ.
const ayar = (stock) => Object.fromEntries(GROUPS.map((g) => [g, g === "STOCK" ? stock : "SKIP"]));
const incoming = (stock) => ({ mainId: "M1", title: "A", description: null, category: "Kristal", basePrice: 100, listPrice: null, images: [], active: true, brand: null, trendyolCategory: null, trendyolUrl: null, variations: [{ barcode: "B1", variationValue: "Altın", extraPrice: 0, stock, stockCode: null, salePrice: 100, listPrice: null }] });
const existing = (stock, syncStock) => ({ id: "p1", trendyolMainId: "M1", title: "A", description: null, category: "Kristal", basePrice: 100, listPrice: null, images: [], active: true, brand: null, trendyolCategory: null, trendyolUrl: null, syncSnapshot: null, variations: [{ id: "v1", barcode: "B1", variationValue: "Altın", extraPrice: 0, stock, stockCode: null, salePrice: 100, listPrice: null, syncStock, syncSnapshot: null }] });
const stockOp = (plan) => plan.products[0].variations[0].write?.stock ?? null;

test("KEEP: sitede satılan 2 adet korunur (T=10, son eşitleme 10, sitede 8 → 8)", () => {
  assert.deepEqual(stockDecision("KEEP", 8, 10, 10, 0), { karar: "KORUNACAK", yeni: 8 });
  const op = stockOp(planSync([existing(8, 10)], [incoming(10)], ayar("KEEP"), {}));
  assert.equal(op, null); // değer değişmiyor ve eşitleme izi güncel: stok yazımı hiç üretilmez
});

test("KEEP: Trendyol'daki düşüş de uygulanır, site satışı üstüne bindirilir (T=7 → 7 + (8−10) = 5)", () => {
  assert.equal(stockDecision("KEEP", 8, 10, 7, 0).yeni, 5);
});

test("KEEP: eşitleme geçmişi yoksa (syncStock null) sitedeki stok aynen kalır", () => {
  assert.equal(stockDecision("KEEP", 8, null, 10, 0).yeni, 8);
});

test("ÜZERİNE YAZ (mevcut davranış): sitede satılıp Trendyol'a yansımamış 2 adet stoğa GERİ döner (8 → 10)", () => {
  const d = stockDecision("OVERWRITE", 8, 10, 10, 0);
  assert.deepEqual(d, { karar: "EZİLECEK", yeni: 10 });
  const op = stockOp(planSync([existing(8, 10)], [incoming(10)], ayar("OVERWRITE"), {}));
  assert.equal(op.mode, "OVERWRITE");
  assert.equal(op.t, 10);
  assert.equal(op.degisir, true);
});

test("ÜZERİNE YAZ: yalnız açık kartlı rezervasyon düşülür (T=10, rezerve 2 → 8; stok zaten 8 ise değişmez)", () => {
  assert.deepEqual(stockDecision("OVERWRITE", 8, 10, 10, 2), { karar: "AYNI", yeni: 8 });
  assert.equal(stockOp(planSync([existing(8, 10)], [incoming(10)], ayar("OVERWRITE"), { v1: 2 })), null);
  const op2 = stockOp(planSync([existing(10, 10)], [incoming(10)], ayar("OVERWRITE"), { v1: 2 }));
  assert.equal(op2.degisir, true); // 10 → 8
});

test("hiçbir mod stoğu eksiye düşürmez", () => {
  assert.equal(stockDecision("OVERWRITE", 5, 5, 1, 4).yeni, 0);
  assert.equal(stockDecision("OVERWRITE", 5, 5, 1, 9).yeni, 0);
  assert.equal(stockDecision("KEEP", 0, 10, 2, 0).yeni, 0);
  // Trendyol eksi miktar bildirirse plan 0'a sabitler
  const op = stockOp(planSync([existing(3, 3)], [incoming(-4)], ayar("OVERWRITE"), {}));
  assert.equal(op.t, 0);
});

test("STOCK = SKIP: stok işlemi üretilmez, fark yalnız ATLANDI olarak bildirilir", () => {
  const plan = planSync([existing(8, 10)], [incoming(10)], ayar("SKIP"), {});
  assert.equal(stockOp(plan), null);
  const f = plan.products[0].variations[0].fields.find((x) => x.alan === "stock");
  assert.equal(f.karar, "ATLANDI");
});

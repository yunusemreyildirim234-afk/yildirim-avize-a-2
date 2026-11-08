import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOW_STOCK, lowStockLabel, resolveLowStock, validThreshold } from "../lib/low-stock.ts";

const on = (threshold = 3) => ({ enabled: true, threshold });

test("rozet kararı: ayar kapalı/açık × stok 0/1/eşik/eşik+1", () => {
  for (const stock of [0, 1, 2, 3, 4, 50]) assert.equal(lowStockLabel(stock, { enabled: false, threshold: 3 }), null, `kapalı stok ${stock}`);
  assert.equal(lowStockLabel(0, on()), null); // Tükendi: rozet yok
  assert.equal(lowStockLabel(1, on()), "Son 1 adet"); // N=1
  assert.equal(lowStockLabel(2, on()), "Son 2 adet");
  assert.equal(lowStockLabel(3, on()), "Son 3 adet"); // eşik dahil
  assert.equal(lowStockLabel(4, on()), null); // eşik+1: yok
  assert.equal(lowStockLabel(-2, on()), null);
  assert.equal(lowStockLabel(Number.NaN, on()), null);
});

test("eşik değişimi rozeti kaydırır", () => {
  assert.equal(lowStockLabel(5, on(3)), null);
  assert.equal(lowStockLabel(5, on(5)), "Son 5 adet");
  assert.equal(lowStockLabel(10, on(10)), "Son 10 adet");
  assert.equal(lowStockLabel(11, on(10)), null);
  assert.equal(lowStockLabel(1, on(1)), "Son 1 adet");
  assert.equal(lowStockLabel(2, on(1)), null);
});

test("ayar çözümü: varsayılan KAPALI/3; yalnızca boolean true açar; eşik 1..10 tam sayı", () => {
  assert.deepEqual(resolveLowStock(null), DEFAULT_LOW_STOCK);
  assert.deepEqual(resolveLowStock({}), { enabled: false, threshold: 3 });
  assert.deepEqual(resolveLowStock({ lowStockBadge: "true" }), { enabled: false, threshold: 3 });
  assert.deepEqual(resolveLowStock({ lowStockBadge: true }), { enabled: true, threshold: 3 });
  assert.deepEqual(resolveLowStock({ lowStockBadge: true, lowStockThreshold: 7 }), { enabled: true, threshold: 7 });
  for (const bad of [0, 11, 2.5, "4", null, -1, Number.NaN]) assert.equal(resolveLowStock({ lowStockBadge: true, lowStockThreshold: bad }).threshold, 3, String(bad));
  assert.equal(validThreshold(1), 1);
  assert.equal(validThreshold(10), 10);
  assert.equal(validThreshold(0), null);
  assert.equal(validThreshold(11), null);
  assert.equal(validThreshold("3"), null);
});

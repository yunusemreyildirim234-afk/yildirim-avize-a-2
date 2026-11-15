import test from "node:test";
import assert from "node:assert/strict";
import { emptyPatch, withPatched, applyPatch, applyHiddenIds, currentPatch } from "../lib/admin-product-patch.ts";

const mk = () => [
  { id: "p1", active: true, variations: [{ id: "v1", stock: 5 }, { id: "v2", stock: 0 }] },
  { id: "p2", active: false, variations: [{ id: "v3", stock: 2 }] },
];

test("yama yoksa aynı dizi döner", () => {
  const base = mk();
  assert.equal(applyPatch(base, emptyPatch(base)), base);
});

test("stok yaması yalnız ilgili varyasyonu değiştirir, diğer ürün aynı nesne kalır", () => {
  const base = mk();
  const patch = withPatched(emptyPatch(base), base, "stock", "v2", 7);
  const out = applyPatch(base, patch);
  assert.equal(out[0].variations[1].stock, 7);
  assert.equal(out[0].variations[0].stock, 5);
  assert.equal(out[1], base[1]);
  assert.equal(base[0].variations[1].stock, 0); // sunucu verisi değişmez
});

test("aktiflik yaması sunucunun döndürdüğü değeri yazar", () => {
  const base = mk();
  const out = applyPatch(base, withPatched(emptyPatch(base), base, "active", "p2", true));
  assert.equal(out[1].active, true);
  assert.equal(out[0], base[0]);
});

test("sunucu listesi değişince (yeni referans) yama sıfırlanır", () => {
  const base = mk();
  const patch = withPatched(emptyPatch(base), base, "stock", "v1", 99);
  const fresh = mk(); // router.refresh sonrası yeni prop
  assert.equal(applyPatch(fresh, patch), fresh);
  assert.deepEqual(currentPatch(patch, fresh).stock, {});
  // yeni listeye yeni yama eskiyi taşımaz
  const next = withPatched(patch, fresh, "active", "p1", false);
  assert.deepEqual(next.stock, {});
  assert.equal(next.base, fresh);
});

test("silinmiş/bilinmeyen ürüne ait yama zarar vermez", () => {
  const base = mk();
  const out = applyPatch(base, withPatched(emptyPatch(base), base, "stock", "yok", 3));
  assert.deepEqual(out, base);
});

test("stoksuzken gizle kimlikleri: ekle/çıkar, yama yoksa aynı dizi", () => {
  const base = mk();
  const ids = ["p2"];
  assert.equal(applyHiddenIds(ids, base, emptyPatch(base)), ids);
  let patch = withPatched(emptyPatch(base), base, "hidden", "p1", true);
  assert.deepEqual(applyHiddenIds(ids, base, patch).sort(), ["p1", "p2"]);
  patch = withPatched(patch, base, "hidden", "p2", false);
  assert.deepEqual(applyHiddenIds(ids, base, patch), ["p1"]);
  assert.equal(applyHiddenIds(ids, mk(), patch), ids); // yeni sunucu listesi → yama yok
});

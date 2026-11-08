import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SYNC_MODES, resolveSyncModes, parseModesStrict, isDefaultModes, overwriteGroups } from "../lib/trendyol-modes.ts";

test("kayıt yoksa varsayılan: Stok Ezerek, diğerleri Dokunma", () => {
  for (const cfg of [null, undefined, {}, [], "x", 5, { trendyolSyncModes: null }, { trendyolSyncModes: [] }, { trendyolSyncModes: "bozuk" }]) {
    const r = resolveSyncModes(cfg);
    assert.deepEqual(r.modes, DEFAULT_SYNC_MODES);
    assert.equal(r.fromSaved, false);
  }
});

test("kayıtlı değerler okunur, bozuk alanlar yalnızca o alan için varsayılana döner", () => {
  const r = resolveSyncModes({ trendyolSyncModes: { STOCK: "KEEP", PRICE: "OVERWRITE", TEXT: "yanlis", IMAGES: 3, ACTIVE: "KEEP" } });
  assert.equal(r.fromSaved, true);
  assert.equal(r.modes.STOCK, "KEEP");
  assert.equal(r.modes.PRICE, "OVERWRITE");
  assert.equal(r.modes.TEXT, "SKIP");
  assert.equal(r.modes.IMAGES, "SKIP");
  assert.equal(r.modes.ACTIVE, "KEEP");
  assert.equal(r.modes.CATEGORY, "SKIP");
});

test("parseModesStrict: eksik, fazla, geçersiz değer reddedilir", () => {
  assert.deepEqual(parseModesStrict({ ...DEFAULT_SYNC_MODES, PRICE: "KEEP" }), { ...DEFAULT_SYNC_MODES, PRICE: "KEEP" });
  assert.equal(parseModesStrict(null), null);
  assert.equal(parseModesStrict([]), null);
  assert.equal(parseModesStrict({ STOCK: "OVERWRITE" }), null);
  assert.equal(parseModesStrict({ ...DEFAULT_SYNC_MODES, PRICE: "x" }), null);
  assert.equal(parseModesStrict({ ...DEFAULT_SYNC_MODES, EXTRA: "SKIP" }), null);
});

test("isDefaultModes ve overwriteGroups", () => {
  assert.equal(isDefaultModes(DEFAULT_SYNC_MODES), true);
  assert.equal(isDefaultModes({ ...DEFAULT_SYNC_MODES, TEXT: "KEEP" }), false);
  assert.deepEqual(overwriteGroups(DEFAULT_SYNC_MODES), ["STOCK"]);
  assert.deepEqual(overwriteGroups({ ...DEFAULT_SYNC_MODES, PRICE: "OVERWRITE" }), ["STOCK", "PRICE"]);
});

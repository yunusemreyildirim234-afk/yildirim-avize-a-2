import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("stok +/−: yanıttaki değer yerele yazılır, router.refresh çağrılmaz; diğer işlemler yeniler", () => {
  const s = read("components/AdminProductList.tsx");
  const fn = s.slice(s.indexOf("const handleStockChange"), s.indexOf("// Site model kodunu kaydet"));
  assert.doesNotMatch(fn, /router\.refresh/);
  assert.match(fn, /setStockPatch/);
  assert.match(fn, /data\.variation\?\.stock/);
  assert.match(s, /stockPatch\.base === serverProducts/);
  assert.ok((s.match(/router\.refresh\(\)/g) ?? []).length >= 4);
});

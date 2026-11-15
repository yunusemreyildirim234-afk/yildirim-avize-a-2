import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("stok +/−: yanıttaki değer yerele yazılır, başarıda yenileme yok (yalnız 409'da hemen); diğer işlemler yenileme düzenini kullanır", () => {
  const s = read("components/AdminProductList.tsx");
  const fn = s.slice(s.indexOf("const handleStockChange"), s.indexOf("// Site model kodunu kaydet"));
  assert.doesNotMatch(fn, /router\.refresh|scheduleAdminRefresh/);
  assert.equal((fn.match(/refreshAdminNow/g) ?? []).length, 1);
  assert.match(fn, /res\.status === 409/);
  assert.match(fn, /withPatched\(cur, serverProducts, "stock"/);
  assert.match(fn, /data\.variation\?\.stock/);
  assert.doesNotMatch(s, /router\.refresh\(\)/); // doğrudan çağrı kalmadı
  assert.ok((s.match(/refreshAdminNow\(router\)/g) ?? []).length >= 6);
  assert.equal((s.match(/scheduleAdminRefresh\(router\)/g) ?? []).length, 2); // yalnız aktif/pasif ve stoksuz-gizle
});

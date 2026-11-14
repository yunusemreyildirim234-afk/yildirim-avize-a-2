import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertIncomingSane, TrendyolGuardError } from "../lib/trendyol-guard.ts";
import { parseModesStrict } from "../lib/trendyol-modes.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("boş Trendyol listesi eşitlemeyi durdurur", () => {
  assert.throws(() => assertIncomingSane(0, 0), TrendyolGuardError);
  assert.throws(() => assertIncomingSane(0, 40), /boş geldi/);
});

test("gelen liste eşleşmiş ürünlerin yarısından azsa durur; yarı ve üstü geçer", () => {
  assert.throws(() => assertIncomingSane(19, 40), /eksik görünüyor/);
  assert.doesNotThrow(() => assertIncomingSane(20, 40));
  assert.doesNotThrow(() => assertIncomingSane(55, 40));
  assert.doesNotThrow(() => assertIncomingSane(3, 0)); // henüz eşleşmiş ürün yok: ilk içe aktarma
});

test("ayarlar eksik ya da geçersizse sıkı ayrıştırıcı null döner (eksik grup KEEP sayılmaz)", () => {
  assert.equal(parseModesStrict(undefined), null);
  assert.equal(parseModesStrict({ STOCK: "OVERWRITE" }), null);
  assert.equal(parseModesStrict({ STOCK: "X", PRICE: "SKIP", TEXT: "SKIP", IMAGES: "SKIP", CATEGORY: "SKIP", VARIANT_INFO: "SKIP", ACTIVE: "SKIP" }), null);
});

test("uç: uygulamada sıkı ayar → 400; koruma hatası 422; buildPlan denetimi çağırır", () => {
  const r = read("app/api/admin/trendyol/sync/route.ts");
  assert.match(r, /dryRun === false && !strict/);
  assert.match(r, /status: 400/);
  assert.match(r, /TrendyolGuardError/);
  assert.match(read("lib/trendyol-sync.ts"), /assertIncomingSane\(gelen\.length, rows\.length\)/);
});

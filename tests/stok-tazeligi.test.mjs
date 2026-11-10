import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyLiveStock, runQuietly } from "../lib/stock-freshness.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const cached = { id: "p1", title: "Avize", variations: [{ id: "v1", stock: 5, variationValue: "Altın" }, { id: "v2", stock: 0, variationValue: "Krom" }] };

test("canlı stok önbellekli ürünün stoklarını ezer; diğer alanlar ve girdi değişmez", () => {
  const out = applyLiveStock(cached, [{ id: "v1", stock: 0 }, { id: "v2", stock: 3 }]);
  assert.deepEqual(out.variations, [{ id: "v1", stock: 0, variationValue: "Altın" }, { id: "v2", stock: 3, variationValue: "Krom" }]);
  assert.equal(out.title, "Avize");
  assert.equal(cached.variations[0].stock, 5, "önbellekli nesne değiştirilmez");
});

test("canlı okuma başarısız/boşsa ya da varyasyon listede yoksa önbellekli stok kalır", () => {
  assert.equal(applyLiveStock(cached, null), cached);
  assert.equal(applyLiveStock(cached, []), cached);
  assert.deepEqual(applyLiveStock(cached, [{ id: "v2", stock: 7 }]).variations.map((v) => v.stock), [5, 7]);
  assert.deepEqual(applyLiveStock(cached, [{ id: "v1", stock: Number.NaN }]).variations.map((v) => v.stock), [5, 0], "geçersiz değer yazılmaz");
});

test("en iyi çaba: yenileme hata verirse yutulur, çağıran bozulmaz", () => {
  let seen = null;
  assert.equal(runQuietly(() => {}), true);
  assert.equal(runQuietly(() => { throw new Error("istek kapsamı yok"); }, (e) => { seen = e.message; }), false);
  assert.equal(seen, "istek kapsamı yok");
  assert.equal(runQuietly(() => { throw new Error("x"); }, () => { throw new Error("bildirim de bozuk"); }), false);
});

test("bağlantılar: ürün sayfası stoğu canlı okur; stok değiştiren yollar transaction SONRASI en iyi çaba ile vitrini yeniler", () => {
  const page = read("../app/urun/[id]/page.tsx");
  assert.match(page, /applyLiveStock\(cachedProduct, await getLiveStocks\(id\)\.catch\(\(\) => null\)\)/);
  assert.ok(!/unstable_cache/.test(read("../lib/products.ts").split("export const getLiveStocks")[1].split("\n")[0]), "canlı stok önbelleğe alınmaz");

  const rev = read("../lib/revalidate.ts");
  assert.match(rev, /export function revalidateStorefrontSafe\(\): boolean \{\s*return runQuietly\(revalidateStorefront,/);

  const orders = read("../lib/orders.ts");
  assert.match(orders, /\}, TX_OPTIONS\);\s*if \(stockChanged\) revalidateStorefrontSafe\(\);/, "stok düşümü: transaction sonrası");
  assert.match(orders, /restoreStockInTx\(tx as unknown as RestoreTx, orderId\), TX_OPTIONS\);\s*revalidateStorefrontSafe\(\);/, "stok iadesi: transaction sonrası");
  assert.match(orders, /\}, TX_OPTIONS\);\s*if \(cancelled\) revalidateStorefrontSafe\(\);[^\n]*\n\s*return cancelled;/, "havale iptali: transaction sonrası");
  assert.equal((orders.match(/revalidateStorefront\(\)/g) ?? []).length, 0, "korumalı dosyada yalnızca en iyi çaba sürümü");

  const route = read("../app/api/order/route.ts");
  const created = route.indexOf("order = await createOrderTx();");
  const call = route.indexOf("revalidateStorefrontSafe();");
  assert.ok(created > 0 && call > route.lastIndexOf("order = await createOrderTx();") && call < route.indexOf("// 4a. Havale/EFT"), "sipariş kaydından sonra, yanıttan önce");
  assert.equal((route.match(/revalidateStorefrontSafe\(\)/g) ?? []).length, 1);

  assert.match(read("../app/api/cron/reminders/route.ts"), /if \(closed > 0 \|\| bankCancelled > 0 \|\| stuck\.length > 0\) revalidateStorefrontSafe\(\);/);
});

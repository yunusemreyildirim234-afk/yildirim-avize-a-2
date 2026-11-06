import test from "node:test";
import assert from "node:assert/strict";
import { composeSection, resolveConfig, resolveHiddenBestSellers } from "../lib/homepage-compose.ts";
import { SHOWCASE_ORDER_BY } from "../lib/showcase-order.ts";

test("vitrin sırası updatedAt'a bağlı değil: eklenme tarihi azalan, eşitlikte id", () => {
  assert.deepEqual(SHOWCASE_ORDER_BY, [{ createdAt: "desc" }, { id: "asc" }]);
  assert.ok(!JSON.stringify(SHOWCASE_ORDER_BY).includes("updatedAt"));
});

test("gizlenen Çok Satanlar kimlikleri: geçersiz/eksik → boş, tekrarlar atılır", () => {
  assert.deepEqual(resolveHiddenBestSellers(null), []);
  assert.deepEqual(resolveHiddenBestSellers({}), []);
  assert.deepEqual(resolveHiddenBestSellers({ hiddenBestSellers: "x" }), []);
  assert.deepEqual(resolveHiddenBestSellers({ hiddenBestSellers: ["a", "a", 3, "", "b"] }), ["a", "b"]);
});

test("gizleme alanı bölüm ayarlarını bozmaz; elle sabitleme önceliği korunur", () => {
  const cfg = resolveConfig({ hiddenBestSellers: ["x"], bestsellers: { count: 2, pinnedIds: ["p2"] } });
  assert.equal(cfg.bestsellers.count, 2);
  const pool = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
  assert.deepEqual(composeSection(pool, cfg.bestsellers).shown.map((p) => p.id), ["p2", "p1"]);
});

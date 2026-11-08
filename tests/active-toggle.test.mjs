import test from "node:test";
import assert from "node:assert/strict";
import { activeConfirmMessage, planActive, TRENDYOL_ACTIVE_NOTE } from "../lib/bulk-plan.ts";

test("planActive: zaten istenen durumdaki ürünler atlanır", () => {
  const rows = [{ id: "a", active: true }, { id: "b", active: false }, { id: "c", active: false }];
  assert.deepEqual(planActive(["a", "b", "c"], rows, true), { targets: ["b", "c"], skipped: 1 });
  assert.deepEqual(planActive(["a", "b", "c"], rows, false), { targets: ["a"], skipped: 2 });
  assert.deepEqual(planActive(["x"], rows, true).targets, ["x"]); // bilinmeyen kimlik: durum yok → uygulanır (sunucu update hata verir)
});

test("onay metni: aktif yap + stok 0 uyarısı + Trendyol notu", () => {
  const one = activeConfirmMessage({ makeActive: true, count: 1, title: "Avize A", soldOut: 1 });
  assert.match(one, /"Avize A" vitrine alınacak/);
  assert.match(one, /Stoğu 0, 'Tükendi' olarak görünecek\./);
  assert.ok(one.includes(TRENDYOL_ACTIVE_NOTE));
  const stocked = activeConfirmMessage({ makeActive: true, count: 1, title: "Avize A", soldOut: 0 });
  assert.doesNotMatch(stocked, /Tükendi/);
  assert.ok(stocked.includes(TRENDYOL_ACTIVE_NOTE));
});

test("onay metni: toplu sayı ve pasife alma", () => {
  const many = activeConfirmMessage({ makeActive: true, count: 5, soldOut: 2 });
  assert.match(many, /5 ürün vitrine alınacak/);
  assert.match(many, /2 ürünün stoğu 0/);
  const off = activeConfirmMessage({ makeActive: false, count: 3 });
  assert.match(off, /3 ürün vitrinden kaldırılacak/);
  assert.ok(off.includes(TRENDYOL_ACTIVE_NOTE));
  assert.match(activeConfirmMessage({ makeActive: false, count: 1, title: "X", stillShown: 1 }), /Tükendi' olarak görünmeye devam edecek/);
});

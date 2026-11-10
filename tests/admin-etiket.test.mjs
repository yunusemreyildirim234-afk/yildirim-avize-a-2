import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GROUP_KEYS, ORDER_GROUPS, matchesGroups } from "../lib/orderStatus.ts";

const group = (key) => ORDER_GROUPS.find((g) => g.key === key);

test("A6: havale onayı bekleyen sipariş 'Ödeme bekliyor' çipinde de sayılır; etiket bunu yazar", () => {
  const odeme = group("odeme");
  assert.equal(odeme.label, "Ödeme bekliyor / başarısız (havale dahil)");
  for (const status of ["AWAITING_PAYMENT", "PAYMENT_FAILED", "PENDING_NEW"]) assert.equal(odeme.test({ status }), true, status);
  for (const status of ["PENDING", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]) assert.equal(odeme.test({ status }), false, status);
});

test("A6: 'Yeni gelen' davranışı değişmedi: havale bekleyen ve hazırlanan siparişler; açılış ön ayarında görünür", () => {
  const yeni = group("yeni");
  assert.equal(yeni.label, "Yeni gelen");
  assert.equal(yeni.test({ status: "PENDING_NEW" }), true);
  assert.equal(yeni.test({ status: "PENDING" }), true);
  assert.equal(yeni.test({ status: "AWAITING_PAYMENT" }), false);
  assert.deepEqual(DEFAULT_GROUP_KEYS, ["yeni", "hazir", "kargoda", "talep"]);
  assert.equal(matchesGroups({ status: "PENDING_NEW" }, DEFAULT_GROUP_KEYS), true);
  assert.equal(matchesGroups({ status: "PENDING_NEW" }, ["odeme"]), true, "yalnızca ödeme çipi seçiliyken de listelenir");
  assert.equal(matchesGroups({ status: "AWAITING_PAYMENT" }, DEFAULT_GROUP_KEYS), false, "kart denemeleri açılışta hâlâ gizli");
});

test("A12: kategori etiketi 'yayında / toplam' biçiminde; toplam yayındakinden küçük gösterilmez", async () => {
  const { categoryCountLabel } = await import("../lib/category-settings.ts");
  assert.equal(categoryCountLabel(11, 18), "11 yayında / 18 toplam");
  assert.equal(categoryCountLabel(0, 4), "0 yayında / 4 toplam");
  assert.equal(categoryCountLabel(5, 3), "5 yayında / 5 toplam", "önbellek gecikmesinde tutarsız etiket çıkmaz");
});

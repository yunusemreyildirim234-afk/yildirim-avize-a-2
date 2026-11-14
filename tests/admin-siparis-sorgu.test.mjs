import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ALL_GROUP_KEYS, ORDER_GROUPS, matchesGroups, parseGroupParam } from "../lib/orderStatus.ts";
import { GROUP_WHERE, groupsWhere, countGroups, countVisible, effectiveDurum, dateWhere, ORDER_LIST_LIMIT } from "../lib/admin-order-query.ts";

const STATUSES = ["AWAITING_PAYMENT", "PAYMENT_FAILED", "PENDING_NEW", "PENDING", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];
const CR = [null, "PENDING", "APPROVED", "REJECTED"];
const ALL_ROWS = STATUSES.flatMap((status) => CR.map((cancelReturnStatus) => ({ status, cancelReturnStatus })));

// Prisma where parçasının küçük değerlendiricisi (yalnız bu dosyada kullanılan biçimler)
const evalFrag = (f, o) => ("status" in f ? f.status.in.includes(o.status) : o.cancelReturnStatus === f.cancelReturnStatus);
const evalWhere = (w, o) => (w === null ? true : w.OR.some((f) => evalFrag(f, o)));

test("her grubun where parçası ORDER_GROUPS.test ile birebir aynı (tüm durum × talep birleşimleri)", () => {
  for (const g of ORDER_GROUPS) for (const o of ALL_ROWS) assert.equal(evalFrag(GROUP_WHERE[g.key], o), g.test(o), `${g.key} ${o.status}/${o.cancelReturnStatus}`);
  assert.deepEqual(Object.keys(GROUP_WHERE).sort(), [...ALL_GROUP_KEYS].sort());
});

test("her grup alt kümesi (256) için groupsWhere ile matchesGroups aynı sonucu verir", () => {
  const keys = ALL_GROUP_KEYS;
  for (let mask = 1; mask < 1 << keys.length; mask++) {
    const sel = keys.filter((_, i) => mask & (1 << i));
    for (const o of ALL_ROWS) assert.equal(evalWhere(groupsWhere(sel), o), matchesGroups(o, sel), `${sel.join(",")} ${o.status}/${o.cancelReturnStatus}`);
  }
  assert.equal(groupsWhere(ALL_GROUP_KEYS), null);
});

test("varsayılan görünüm yalnız açık işler: yeni, hazır, kargoda, talep", () => {
  const keys = parseGroupParam(undefined);
  assert.deepEqual([...keys].sort(), ["hazir", "kargoda", "talep", "yeni"]);
  assert.equal(evalWhere(groupsWhere(keys), { status: "DELIVERED", cancelReturnStatus: null }), false);
  assert.equal(evalWhere(groupsWhere(keys), { status: "CANCELLED", cancelReturnStatus: null }), false);
});

test("arama/tarih açıkken ve ?durum= yokken tüm durumlarda aranır; açık durum seçimi korunur", () => {
  assert.equal(effectiveDurum(undefined, true), "tumu");
  assert.equal(effectiveDurum(undefined, false), undefined);
  assert.equal(effectiveDurum("iptal", true), "iptal");
  const keys = parseGroupParam(effectiveDurum(undefined, true));
  assert.equal(keys.length, ALL_GROUP_KEYS.length);
  assert.equal(groupsWhere(keys), null); // süzgeçsiz: teslim/iptal de gelir
});

test("sayaçlar: veritabanı kümelerinden (durum × talep) hesaplanan değerler bugünkü satır satır sayımla birebir aynı", () => {
  // sahte sipariş havuzu: her birleşimden farklı adette
  const orders = ALL_ROWS.flatMap((r, i) => Array.from({ length: (i % 3) + 1 }, () => ({ ...r })));
  const expected = Object.fromEntries(ORDER_GROUPS.map((g) => [g.key, orders.filter((o) => g.test(o)).length]));
  const grouped = new Map();
  for (const o of orders) {
    const k = `${o.status}|${o.cancelReturnStatus}`;
    grouped.set(k, { status: o.status, cancelReturnStatus: o.cancelReturnStatus, n: (grouped.get(k)?.n ?? 0) + 1 });
  }
  const { counts, total } = countGroups([...grouped.values()]);
  assert.deepEqual(counts, expected);
  assert.equal(total, orders.length);
  for (const keys of [parseGroupParam(undefined), ["teslim"], ["iptal", "iade"], ALL_GROUP_KEYS]) {
    assert.equal(countVisible([...grouped.values()], keys), orders.filter((o) => matchesGroups(o, keys)).length);
  }
});

test("tarih aralığı sonsuz uçlarda Prisma filtresine doğru çevrilir", () => {
  assert.equal(dateWhere(null), null);
  const w = dateWhere({ start: Date.UTC(2026, 10, 1), end: Infinity });
  assert.deepEqual(Object.keys(w.createdAt), ["gte"]);
  const w2 = dateWhere({ start: -Infinity, end: Date.UTC(2026, 10, 2) });
  assert.deepEqual(Object.keys(w2.createdAt), ["lt"]);
  assert.equal(ORDER_LIST_LIMIT, 100);
});

test("panel: siparişler tam listeden değil sunucu sorgularından gelir", () => {
  const p = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  assert.match(p, /take: ORDER_LIST_LIMIT/);
  assert.match(p, /groupBy\(\{ by: \["status", "cancelReturnStatus"\]/);
  assert.doesNotMatch(p, /orders\.filter\(/);
  assert.match(p, /İlk {ORDER_LIST_LIMIT} kayıt gösteriliyor; aramayla daralt/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { StockConflict, applyStockEdits, planBulkStockSet, planStockWrite } from "../lib/stock-edit.ts";

// Bellek içi stok + rotadaki koşullu UPDATE (WHERE stock = expected); runTx hata olursa geri alır
function mkDb(stock) {
  const cas = async (id, expected, next) => {
    if (stock[id] !== expected) return false;
    stock[id] = next;
    return true;
  };
  const runTx = async (fn) => {
    const snap = { ...stock };
    try {
      return await fn();
    } catch (e) {
      for (const k of Object.keys(stock)) delete stock[k];
      Object.assign(stock, snap);
      throw e;
    }
  };
  return { cas, runTx };
}
const save = async (db, id, next, prev) => {
  const plan = planStockWrite(next, prev);
  if (plan.kind !== "CAS") return plan.kind;
  return (await db.cas(id, plan.expected, plan.next)) ? "WRITTEN" : "CONFLICT";
};

test("stok değişmediyse hiç yazılmaz: fiyat farkı kaydı araya giren siparişin rezervasyonunu ezmez", async () => {
  const stock = { v1: 5 };
  const db = mkDb(stock);
  stock.v1 = 3; // panel açıkken sipariş 2 adet ayırdı
  assert.equal(await save(db, "v1", 5, 5), "SKIP"); // yönetici stoğa dokunmadan kaydetti
  assert.equal(stock.v1, 3);
});

test("stok değiştiyse yalnızca başlangıç değeri hâlâ geçerliyse yazılır; araya sipariş girdiyse çakışma", async () => {
  const stock = { v1: 5 };
  const db = mkDb(stock);
  assert.equal(await save(db, "v1", 6, 5), "WRITTEN");
  assert.equal(stock.v1, 6);
  stock.v1 = 4; // sipariş 2 adet ayırdı; yönetici ekranında hâlâ 6
  assert.equal(await save(db, "v1", 7, 6), "CONFLICT");
  assert.equal(stock.v1, 4, "rezervasyon korunur");
});

test("aynı stoğu iki sekmeden +1: yalnızca biri yazılır", async () => {
  const stock = { v1: 5 };
  const db = mkDb(stock);
  const out = await Promise.all([save(db, "v1", 6, 5), save(db, "v1", 6, 5)]);
  assert.deepEqual(out.sort(), ["CONFLICT", "WRITTEN"]);
  assert.equal(stock.v1, 6);
});

test("başlangıç değeri gönderilmezse (eski sekme) mutlak yazıma düşülmez", () => {
  for (const prev of [undefined, null, "5", -1, 1.5]) assert.equal(planStockWrite(3, prev).kind, "INVALID");
  assert.equal(planStockWrite(-1, 5).kind, "INVALID");
});

test("toplu stok = X: zaten X olan atlanır, diğerleri görülen değerle koşullu yazılır", async () => {
  const stock = { a: 10, b: 2, c: 0 };
  const db = mkDb(stock);
  const plan = planBulkStockSet(["a", "b", "c"], { a: 10, b: 2, c: 0 }, 10);
  assert.deepEqual(plan, { edits: [{ id: "b", expected: 2, next: 10 }, { id: "c", expected: 0, next: 10 }], missing: [] });
  assert.equal(await db.runTx(() => applyStockEdits(plan.edits, db.cas)), 2);
  assert.deepEqual(stock, { a: 10, b: 10, c: 10 });
});

test("toplu stok = X: bir renkte araya sipariş girdiyse hiçbiri yazılmaz", async () => {
  const stock = { a: 4, b: 2 };
  const db = mkDb(stock);
  const plan = planBulkStockSet(["a", "b"], { a: 4, b: 2 }, 10); // yöneticinin listede gördüğü
  stock.b = 1; // sipariş
  await assert.rejects(db.runTx(() => applyStockEdits(plan.edits, db.cas)), (e) => e instanceof StockConflict && e.ids.join() === "b");
  assert.deepEqual(stock, { a: 4, b: 1 }, "a'nın yazımı geri alınır, b'nin rezervasyonu korunur");
});

test("toplu stok = X: yöneticinin görmediği (sonradan eklenen) renk çakışma sayılır; geçersiz harita da", () => {
  assert.deepEqual(planBulkStockSet(["a", "yeni"], { a: 1 }, 5).missing, ["yeni"]);
  assert.deepEqual(planBulkStockSet(["a"], undefined, 5).missing, ["a"]);
  assert.deepEqual(planBulkStockSet(["a"], [5], 5).missing, ["a"]);
});

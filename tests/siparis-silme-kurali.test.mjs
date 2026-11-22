import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isOrderDeletable, DELETE_GUARD_HOURS } from "../lib/stock-rules.ts";
import { deleteOrderRowsInTx, OrderDeleteConflictError } from "../lib/order-delete.ts";

const NOW = Date.parse("2026-11-04T12:00:00Z");
const H = 3_600_000;
const o = (status, hoursAgo = 100, extra = {}) => ({ status, createdAt: new Date(NOW - hoursAgo * H), ...extra });

test("silinebilir: ödeme başarısız, iptal, süresi geçmiş ödeme bekleyen", () => {
  assert.equal(isOrderDeletable(o("PAYMENT_FAILED", 0), NOW), true);
  assert.equal(isOrderDeletable(o("CANCELLED", 0, { paymentMethod: "BANK_TRANSFER", receiptUrl: null }), NOW), true);
  assert.equal(isOrderDeletable(o("AWAITING_PAYMENT", DELETE_GUARD_HOURS + 1), NOW), true);
});

test("silinemez: taze ödeme bekleyen, ödenmiş, hazırlanan, kargodaki, teslim, iade", () => {
  assert.equal(isOrderDeletable(o("AWAITING_PAYMENT", 0.5), NOW), false);
  for (const s of ["PENDING_NEW", "PENDING", "PREPARING", "SHIPPED", "DELIVERED", "RETURNED"]) {
    assert.equal(isOrderDeletable(o(s), NOW), false, s);
  }
});

test("silme ucu bu kuralı kullanır ve 409 döner", () => {
  const s = readFileSync(new URL("../app/api/admin/orders/route.ts", import.meta.url), "utf8");
  assert.match(s, /isOrderDeletable\(o, Date\.now\(\)\)/);
  assert.match(s, /silinebilir durumda değil/);
});

test("kartlı veya dekontlu iptal siparişi silinemez", () => {
  assert.equal(isOrderDeletable(o("CANCELLED", 0, { paymentMethod: "CREDIT_CARD", receiptUrl: null }), NOW), false);
  assert.equal(isOrderDeletable(o("CANCELLED", 0, { paymentMethod: "BANK_TRANSFER", receiptUrl: "/api/receipts/x" }), NOW), false);
  assert.equal(isOrderDeletable(o("CANCELLED", 0), NOW), false);
});

test("silme ucu kartlı iptal mesajını içerir", () => {
  const s = readFileSync(new URL("../app/api/admin/orders/route.ts", import.meta.url), "utf8");
  assert.match(s, /Kartla ödenip iptal edilen siparişler muhasebe için saklanır/);
});

const fakeTx = (count) => {
  const calls = [];
  const del = (name) => async (a) => (calls.push([name, a]), { count: name === "order" ? count : 0 });
  return { calls, tx: { notification: { deleteMany: del("notification") }, receiptFile: { deleteMany: del("receiptFile") }, orderInvoice: { deleteMany: del("orderInvoice") }, orderItem: { deleteMany: del("orderItem") }, order: { deleteMany: del("order") } } };
};

test("silme işlemi: sipariş deleteMany'ye silinebilir durum koşulu eklenir", async () => {
  const { tx, calls } = fakeTx(2);
  assert.equal(await deleteOrderRowsInTx(tx, ["a", "b"], ["/l/a", "/l/b"], true, NOW), 2);
  const where = calls.find((c) => c[0] === "order")[1].where;
  assert.deepEqual(where.id, { in: ["a", "b"] });
  assert.equal(where.OR.length, 3);
});

test("silinen sayı istenenden azsa hata fırlatır (işlem geri alınır)", async () => {
  const { tx } = fakeTx(1);
  await assert.rejects(() => deleteOrderRowsInTx(tx, ["a", "b"], [], false, NOW), OrderDeleteConflictError);
});

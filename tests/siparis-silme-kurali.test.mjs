import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isOrderDeletable, DELETE_GUARD_HOURS } from "../lib/stock-rules.ts";
import { deleteOrderRowsInTx, OrderDeleteConflictError, OrderInvoicedError } from "../lib/order-delete.ts";

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
  for (const s of ["PENDING_NEW", "PENDING", "PREPARING", "READY_FOR_PICKUP", "PAID", "SHIPPED", "DELIVERED"]) {
    assert.equal(isOrderDeletable(o(s), NOW), false, s);
    assert.equal(isOrderDeletable(o(s, 100, { hasInvoice: false }), NOW), false, `${s} faturasız`);
  }
});

test("iade edilen: yalnız faturasızsa silinir; fatura bilinmiyorsa silinmez", () => {
  assert.equal(isOrderDeletable(o("RETURNED", 100, { hasInvoice: false }), NOW), true);
  assert.equal(isOrderDeletable(o("RETURNED", 100, { hasInvoice: true }), NOW), false);
  assert.equal(isOrderDeletable(o("RETURNED"), NOW), false);
});

test("silme ucu: faturalı iade 409 + Türkçe mesaj; günlükte yalnız kimlik ve durum; arayüzde alert/confirm yok", () => {
  const s = readFileSync(new URL("../app/api/admin/orders/route.ts", import.meta.url), "utf8");
  assert.match(s, /INVOICED_ORDER_DELETE_ERROR \}, \{ status: 409 \}/);
  assert.match(s, /console\.info\(`\[admin\/orders\/delete\] id=\$\{o\.id\} status=\$\{o\.status\}`\)/);
  const msg = readFileSync(new URL("../lib/order-delete.ts", import.meta.url), "utf8");
  assert.match(msg, /Faturası yüklenmiş sipariş silinemez; önce faturayı kaldırmanız gerekir/);
  const btn = readFileSync(new URL("../components/AdminDeleteButton.tsx", import.meta.url), "utf8");
  assert.ok(!/\balert\(|\bconfirm\(/.test(btn));
  assert.match(btn, /toast\.error/);
  const page = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const line = page.split(/\r?\n/).find((l) => l.includes('label="Siparişi Sil"'));
  assert.match(line, /order\.id\.slice\(0, 8\)/);
  assert.match(line, /totalAmount/);
  assert.match(line, /Bu işlem geri alınamaz; sipariş ve ona bağlı kayıtlar silinir/);
});

test("iade silme: fatura varsa işlem içinde OrderInvoicedError, hiçbir şey silinmez", async () => {
  const { tx, calls } = fakeTx(1);
  tx.orderInvoice.findMany = async () => [{ orderId: "r1" }];
  await assert.rejects(() => deleteOrderRowsInTx(tx, ["r1"], [], true, NOW, [{ id: "r1", status: "RETURNED" }]), OrderInvoicedError);
  assert.equal(calls.length, 0);
});

test("iade silme: faturasız iade silinir; iade olmayanda fatura sorgusu yok", async () => {
  const a = fakeTx(1);
  a.tx.orderInvoice.findMany = async () => [];
  assert.equal(await deleteOrderRowsInTx(a.tx, ["r1"], [], true, NOW, [{ id: "r1", status: "RETURNED" }]), 1);
  assert.deepEqual(a.calls.find((c) => c[0] === "order")[1].where.OR[1], { status: "RETURNED" });
  const b = fakeTx(1);
  b.tx.orderInvoice.findMany = async () => { throw new Error("çağrılmamalı"); };
  assert.equal(await deleteOrderRowsInTx(b.tx, ["f1"], [], true, NOW, [{ id: "f1", status: "PAYMENT_FAILED" }]), 1);
});

test("silme ucu bu kuralı kullanır ve 409 döner", () => {
  const s = readFileSync(new URL("../app/api/admin/orders/route.ts", import.meta.url), "utf8");
  assert.match(s, /isOrderDeletable\(\{ \.\.\.o, hasInvoice: false \}, Date\.now\(\)\)/);
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
  assert.equal(where.OR.length, 4);
});

test("silinen sayı istenenden azsa hata fırlatır (işlem geri alınır)", async () => {
  const { tx } = fakeTx(1);
  await assert.rejects(() => deleteOrderRowsInTx(tx, ["a", "b"], [], false, NOW), OrderDeleteConflictError);
});

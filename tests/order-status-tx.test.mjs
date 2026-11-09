import test from "node:test";
import assert from "node:assert/strict";
import { UndoRefusal, applyStatusChangeInTx, applyUndoInTx } from "../lib/order-undo.ts";
import { restoreStockInTx } from "../lib/stock-restore.ts";

// Bellek içi veritabanı: runTx hata olursa anlık görüntüye döner (transaction geri alma)
function makeDb(opts = {}) {
  const state = {
    order: { id: "o1", status: "PENDING_NEW", stockDeducted: true, couponCode: "KOD" },
    items: [
      { variationId: "v2", quantity: 1, variation: { variationValue: "b", product: { title: "U" } } },
      { variationId: "v1", quantity: 2, variation: { variationValue: "a", product: { title: "U" } } },
    ],
    stock: { v1: 0, v2: 0 },
    used: 1,
    order_of_updates: [],
  };
  const match = (w) => Object.entries(w).every(([k, v]) => state.order[k] === v);
  const tx = {
    order: {
      findUnique: async () => ({ status: state.order.status, stockDeducted: state.order.stockDeducted, couponCode: state.order.couponCode }),
      updateMany: async ({ where, data }) => {
        if (!match(where)) return { count: 0 };
        Object.assign(state.order, data);
        return { count: 1 };
      },
    },
    orderItem: { findMany: async ({ orderBy } = {}) => (orderBy ? [...state.items].sort((a, b) => a.variationId.localeCompare(b.variationId)) : state.items) },
    productVariation: {
      update: async ({ where, data }) => {
        if (opts.failStock) throw new Error("stok hatası");
        state.order_of_updates.push(where.id);
        state.stock[where.id] += data.stock.increment;
      },
    },
  };
  const runTx = async (fn) => {
    const snap = structuredClone(state);
    try {
      return await fn(tx);
    } catch (e) {
      Object.assign(state, snap);
      throw e;
    }
  };
  const release = async () => {
    if (opts.failCoupon) throw new Error("kupon hatası");
    state.used -= 1;
  };
  return { state, tx, runTx, release };
}

const cancel = (d) => d.runTx((tx) => applyStatusChangeInTx(tx, "o1", "CANCELLED", d.release));

test("iptal: durum, stok ve kupon birlikte uygulanır", async () => {
  const d = makeDb();
  const r = await cancel(d);
  assert.equal(r.outcome, "OK");
  assert.equal(d.state.order.status, "CANCELLED");
  assert.deepEqual(d.state.stock, { v1: 2, v2: 1 });
  assert.equal(d.state.order.stockDeducted, false);
  assert.equal(d.state.used, 0);
});

test("stok iadesi hata verirse durum değişmez, kupon iade edilmez", async () => {
  const d = makeDb({ failStock: true });
  await assert.rejects(cancel(d), /stok hatası/);
  assert.equal(d.state.order.status, "PENDING_NEW");
  assert.equal(d.state.order.stockDeducted, true);
  assert.equal(d.state.used, 1);
});

test("kupon iadesi hata verirse durum ve stok geri alınır", async () => {
  const d = makeDb({ failCoupon: true });
  await assert.rejects(cancel(d), /kupon hatası/);
  assert.equal(d.state.order.status, "PENDING_NEW");
  assert.deepEqual(d.state.stock, { v1: 0, v2: 0 });
  assert.equal(d.state.order.stockDeducted, true);
});

test("çift tıklama: ikinci iptal ikinci kez iade yapmaz", async () => {
  const d = makeDb();
  await cancel(d);
  const again = await cancel(d);
  assert.equal(again.outcome, "OK");
  assert.equal(again.plan.restoreStock, false);
  assert.deepEqual(d.state.stock, { v1: 2, v2: 1 });
  assert.equal(d.state.used, 0);
});

test("yarış: okunan durum değiştiyse CONFLICT, iade yok", async () => {
  const d = makeDb();
  const racing = { ...d.tx, order: { ...d.tx.order, updateMany: async () => ({ count: 0 }) } };
  const r = await applyStatusChangeInTx(racing, "o1", "CANCELLED", d.release);
  assert.equal(r.outcome, "CONFLICT");
  assert.deepEqual(d.state.stock, { v1: 0, v2: 0 });
  assert.equal(d.state.used, 1);
});

test("olmayan sipariş NOT_FOUND", async () => {
  const d = makeDb();
  const none = { ...d.tx, order: { ...d.tx.order, findUnique: async () => null } };
  assert.equal((await applyStatusChangeInTx(none, "x", "CANCELLED", d.release)).outcome, "NOT_FOUND");
});

test("stok iadesi variationId sırasıyla ve aynı varyasyon birleşik yapılır", async () => {
  const d = makeDb();
  d.state.items.push({ variationId: "v1", quantity: 1, variation: { variationValue: "a", product: { title: "U" } } });
  await d.runTx((tx) => restoreStockInTx(tx, "o1"));
  assert.deepEqual(d.state.order_of_updates, ["v1", "v2"]);
  assert.equal(d.state.stock.v1, 3);
});

const undoReq = { orderId: "o1", from: "PENDING_NEW", to: "CANCELLED", restoredStock: true, coupon: "KOD" };
const undoDeps = (d, ok = true) => ({
  deduct: async (id, q) => {
    if (!ok) return false;
    d.state.order_of_updates.push(id);
    d.state.stock[id] -= q;
    return true;
  },
  reserve: async () => {
    d.state.used += 1;
    return true;
  },
});

test("Geri Al: durum, stok ve kupon başlangıca döner; stok sıralı düşülür", async () => {
  const d = makeDb();
  await cancel(d);
  d.state.order_of_updates.length = 0;
  await d.runTx((tx) => applyUndoInTx(tx, undoReq, undoDeps(d)));
  assert.equal(d.state.order.status, "PENDING_NEW");
  assert.equal(d.state.order.stockDeducted, true);
  assert.deepEqual(d.state.stock, { v1: 0, v2: 0 });
  assert.deepEqual(d.state.order_of_updates, ["v1", "v2"]);
  assert.equal(d.state.used, 1);
});

test("Geri Al iki kez çalışmaz; stok yetmezse hiçbir şey değişmez", async () => {
  const d = makeDb();
  await cancel(d);
  await assert.rejects(d.runTx((tx) => applyUndoInTx(tx, undoReq, undoDeps(d, false))), UndoRefusal);
  assert.equal(d.state.order.status, "CANCELLED");
  assert.equal(d.state.order.stockDeducted, false);
  await d.runTx((tx) => applyUndoInTx(tx, undoReq, undoDeps(d)));
  await assert.rejects(d.runTx((tx) => applyUndoInTx(tx, undoReq, undoDeps(d))), UndoRefusal);
  assert.deepEqual(d.state.stock, { v1: 0, v2: 0 });
});

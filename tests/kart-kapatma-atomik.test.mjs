import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { closeAwaitingCardInTx } from "../lib/order-swap.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// Bellek içi veritabanı: runTx hata olursa anlık görüntüye döner (transaction geri alma). failStockOnce: stok iadesi bir kez kesilir.
function makeDb({ failStockOnce = false } = {}) {
  const state = { order: { status: "AWAITING_PAYMENT", paymentMethod: "CREDIT_CARD", stockDeducted: true, couponCode: "TEK" }, stock: 0, used: 1 };
  let stockFail = failStockOnce;
  const tx = {
    order: {
      findUnique: async () => ({ couponCode: state.order.couponCode }),
      updateMany: async ({ where, data }) => {
        if (Object.entries(where).some(([k, v]) => k !== "id" && state.order[k] !== v)) return { count: 0 };
        Object.assign(state.order, data);
        return { count: 1 };
      },
    },
    orderItem: { findMany: async () => [{ variationId: "v1", quantity: 2 }] },
    productVariation: {
      update: async ({ data }) => {
        if (stockFail) { stockFail = false; throw new Error("bağlantı koptu"); }
        state.stock += data.stock.increment;
      },
    },
  };
  const release = async (code) => { if (code) state.used = Math.max(0, state.used - 1); };
  const runTx = async (fn) => {
    const snap = structuredClone(state);
    try { return await fn(tx); } catch (e) { Object.assign(state, structuredClone(snap)); throw e; }
  };
  return { state, close: () => runTx((t) => closeAwaitingCardInTx(t, "o1", release)) };
}

test("A4: başarılı kapanış — durum, stok ve kupon birlikte; ikinci çağrı çift iade yapmaz", async () => {
  const d = makeDb();
  assert.equal(await d.close(), true);
  assert.deepEqual([d.state.order.status, d.state.order.stockDeducted, d.state.stock, d.state.used], ["PAYMENT_FAILED", false, 2, 0]);
  assert.equal(await d.close(), false);
  assert.deepEqual([d.state.stock, d.state.used], [2, 0], "stok ve kupon ikinci kez iade edilmedi");
});

test("A4: kesinti simülasyonu — stok iadesi kesilirse durum da geri alınır (kupon sayacı kaybolmaz); yeniden deneme tamamlar", async () => {
  const d = makeDb({ failStockOnce: true });
  await assert.rejects(d.close(), /bağlantı koptu/);
  assert.deepEqual([d.state.order.status, d.state.order.stockDeducted, d.state.stock, d.state.used], ["AWAITING_PAYMENT", true, 0, 1], "hiçbir adım kalıcı olmadı");
  assert.equal(await d.close(), true);
  assert.deepEqual([d.state.order.status, d.state.stock, d.state.used], ["PAYMENT_FAILED", 2, 0], "yeniden deneme tam kapattı, tek iade");
});

test("A4: failAwaitingCardOrder tek $transaction + closeAwaitingCardInTx kullanır; callback ve sipariş ucu parçalı adımları bırakır", () => {
  const orders = read("lib/orders.ts");
  const fn = orders.slice(orders.indexOf("export async function failAwaitingCardOrder"), orders.indexOf("export async function releaseStaleReservations"));
  assert.match(fn, /prisma\.\$transaction\(\(tx\) => closeAwaitingCardInTx\(tx as unknown as SwapTx, orderId, \(code\) => releaseCoupon\(code, tx\)\), TX_OPTIONS\)/);
  assert.doesNotMatch(fn, /restoreOrderStock|updateMany|\.catch\(/, "transaction dışı adım/yutulan hata yok");
  const cb = read("app/api/paytr/callback/route.ts");
  assert.match(cb, /failAwaitingCardOrder\(orderId\)/);
  assert.doesNotMatch(cb, /restoreOrderStock|releaseCoupon/);
  const ord = read("app/api/order/route.ts");
  assert.match(ord, /closeAwaitingCardInTx\(tx as unknown as SwapTx, order\.id, \(code\) => releaseCoupon\(code, tx\)\)/);
  assert.doesNotMatch(ord, /restoreOrderStock|releaseCoupon\(appliedCouponCode\)/);
});

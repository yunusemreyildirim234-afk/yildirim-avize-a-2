import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { closeAwaitingCardInTx, heldCouponUses, swapAndCreate } from "../lib/order-swap.ts";
import { planPendingCleanup } from "../lib/pending-orders.ts";
import { StockShortError, reserveLines } from "../lib/stock-reserve.ts";

// Bellek içi veritabanı: siparişler + stok + kupon sayacı. runTx hata olursa anlık görüntüye döner (transaction geri alma).
function makeDb({ stock = 0, used = 1 } = {}) {
  const state = {
    orders: { eski: { status: "AWAITING_PAYMENT", paymentMethod: "CREDIT_CARD", stockDeducted: true, couponCode: "TEK", items: [{ variationId: "v1", quantity: 1 }] } },
    stock: { v1: stock }, // son ürün eski siparişte ayrılı
    used, // TEK kuponu: maxUses 1, eski sipariş kullanıyor
  };
  const tx = {
    order: {
      findUnique: async ({ where }) => (state.orders[where.id] ? { couponCode: state.orders[where.id].couponCode } : null),
      updateMany: async ({ where, data }) => {
        const o = state.orders[where.id];
        if (!o || Object.entries(where).some(([k, v]) => k !== "id" && o[k] !== v)) return { count: 0 };
        Object.assign(o, data);
        return { count: 1 };
      },
    },
    orderItem: { findMany: async ({ where }) => state.orders[where.orderId].items },
    productVariation: { update: async ({ where, data }) => { state.stock[where.id] += data.stock.increment; } },
  };
  const release = async (code) => { if (code) state.used = Math.max(0, state.used - 1); };
  // app/api/order/route.ts içindeki sipariş oluşturma adımlarının aynısı: kupon limiti (maxUses=1) + koşullu stok + kayıt
  const createNew = (qty = 1, coupon = "TEK") => async () => {
    if (coupon) {
      if (state.used >= 1) throw new Error("kupon-limit");
      state.used += 1;
    }
    await reserveLines([{ variationId: "v1", quantity: qty }], async (id, q) => {
      if (state.stock[id] < q) return false;
      state.stock[id] -= q;
      return true;
    });
    state.orders.yeni = { status: "AWAITING_PAYMENT", paymentMethod: "CREDIT_CARD", stockDeducted: true, couponCode: coupon, items: [{ variationId: "v1", quantity: qty }] };
    return "yeni";
  };
  const runTx = async (fn) => {
    const snap = structuredClone(state);
    try {
      return await fn(tx);
    } catch (e) {
      for (const k of Object.keys(state)) delete state[k];
      Object.assign(state, snap);
      throw e;
    }
  };
  return { state, tx, release, createNew, runTx };
}

test("bulgu 3: geri dön, tekrar dene (aynı tarayıcı): son ürün ve tek kullanımlık kuponla yeni sipariş açılır, eskisi aynı anda kapanır", async () => {
  const d = makeDb();
  // Aynı tarayıcı önceki sipariş kimliğini bilir → değiştirilecek sipariş
  const plan = planPendingCleanup([{ id: "eski", phone: "05551112233", userId: "g1", user: { email: "ali@x.com", password: "guest_checkout" } }], { email: "ali@x.com", phone: "05551112233", previousOrderId: "eski" });
  assert.deepEqual(plan, { swapIds: ["eski"], blocked: false });
  const id = await d.runTx((tx) => swapAndCreate(tx, plan.swapIds, d.release, d.createNew()));
  assert.equal(id, "yeni");
  assert.equal(d.state.orders.eski.status, "PAYMENT_FAILED");
  assert.equal(d.state.orders.eski.stockDeducted, false);
  assert.equal(d.state.orders.yeni.status, "AWAITING_PAYMENT");
  assert.equal(d.state.stock.v1, 0, "son ürün eskiden yeniye geçti; stok ne eksi ne fazla");
  assert.equal(d.state.used, 1, "kupon hakkı eskiden yeniye geçti");
});

test("bulgu 3: yeni sipariş stok hatasıyla reddedilirse eski sipariş ödeme bekler hâlde kalır (açık ödeme sayfası geçerli)", async () => {
  const d = makeDb();
  const before = structuredClone(d.state);
  await assert.rejects(d.runTx((tx) => swapAndCreate(tx, ["eski"], d.release, d.createNew(2))), StockShortError); // 2 adet istiyor, 1 var
  assert.deepEqual(d.state, before, "eski sipariş, stoğu ve kuponu aynen duruyor");
});

test("bulgu 3: yeni sipariş kupon hatasıyla reddedilirse de eski sipariş kapanmaz", async () => {
  const d = makeDb({ used: 2 }); // limit bu arada başka siparişle de dolmuş: eskinin hakkı iade edilse bile yer yok
  const before = structuredClone(d.state);
  await assert.rejects(d.runTx((tx) => swapAndCreate(tx, ["eski"], d.release, d.createNew())), /kupon-limit/);
  assert.deepEqual(d.state, before);
});

test("bulgu 3: e-posta eşleşse bile kimliği bilinmeyen misafir siparişi kapatılmaz; yeni sipariş kendi stoğuyla değerlendirilir", async () => {
  const d = makeDb();
  const plan = planPendingCleanup([{ id: "eski", phone: "0532 000 00 00", userId: "g1", user: { email: "ali@x.com", password: "guest_checkout" } }], { email: "ali@x.com", phone: "05551112233" });
  assert.deepEqual(plan.swapIds, []);
  const before = structuredClone(d.state);
  await assert.rejects(d.runTx((tx) => swapAndCreate(tx, plan.swapIds, d.release, d.createNew(1, null))), StockShortError);
  assert.deepEqual(d.state, before, "başkasının (ya da başka sekmenin) açık ödemesi etkilenmedi");
});

test("bulgu 3: eski sipariş bu arada ödenmişse kapatılmaz, stoğu ve kuponu iade edilmez", async () => {
  const d = makeDb();
  d.state.orders.eski.status = "PENDING"; // PayTR bildirimi önce geldi
  assert.equal(await d.runTx((tx) => closeAwaitingCardInTx(tx, "eski", d.release)), false);
  assert.equal(d.state.orders.eski.stockDeducted, true);
  assert.deepEqual([d.state.stock.v1, d.state.used], [0, 1]);
});

test("bulgu 3: aynı sipariş iki kez kapatılırsa stok ve kupon bir kez iade edilir", async () => {
  const d = makeDb();
  assert.equal(await d.runTx((tx) => closeAwaitingCardInTx(tx, "eski", d.release)), true);
  assert.equal(await d.runTx((tx) => closeAwaitingCardInTx(tx, "eski", d.release)), false);
  assert.deepEqual([d.state.stock.v1, d.state.used], [1, 0]);
});

test("bulgu 3: değiştirilecek siparişin tuttuğu kupon hakkı ön doğrulamada limitten düşülür", () => {
  assert.equal(heldCouponUses("tek ", ["TEK", null, "BASKA"]), 1);
  assert.equal(heldCouponUses("TEK", []), 0);
  assert.equal(heldCouponUses("TEK", undefined), 0);
});

test("bulgu 3: sipariş rotası eski siparişi doğrulamadan önce kapatmaz; kapatma sipariş transaction'ının içindedir", () => {
  const route = readFileSync(new URL("../app/api/order/route.ts", import.meta.url), "utf8");
  assert.ok(!/releasePreviousCardOrder|enforcePendingLimits|failAwaitingCardOrder/.test(route), "transaction dışı kapatma çağrısı kalmamalı");
  const txStart = route.indexOf("prisma.$transaction(async (tx) =>");
  const swapAt = route.indexOf("swapAndCreate(tx as unknown as SwapTx, swap.swapIds");
  assert.ok(txStart > 0 && swapAt > txStart && swapAt < route.indexOf("reserveCouponLocked(tx"), "önce eski kapatılır, sonra kupon/stok ayrılır; hepsi aynı tx");
  assert.ok(route.indexOf("planPendingSwap(") < route.indexOf("validateCoupon("), "karar doğrulamadan önce, yazma yok");
  const coupons = readFileSync(new URL("../lib/coupons.ts", import.meta.url), "utf8");
  assert.match(coupons, /coupon\.usedCount - heldCouponUses\(coupon\.code, opts\.replacing\?\.couponCodes\) >= coupon\.maxUses/);
});

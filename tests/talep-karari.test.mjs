import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CANCEL_APPROVABLE, RETURN_APPROVABLE, RequestRefusal, decideRequestInTx } from "../lib/order-request.ts";
import { ORDER_STATUSES } from "../lib/order-undo.ts";

// Bellek içi veritabanı: sipariş (talep alanlarıyla) + stok + kupon sayacı; runTx hata olursa anlık görüntüye döner
function makeDb(order = {}) {
  const state = {
    order: { id: "o1", status: "PENDING", stockDeducted: true, couponCode: "KOD", cancelReturnType: "CANCEL", cancelReturnStatus: "PENDING", cancelReturnNote: null, ...order },
    items: [{ variationId: "v1", quantity: 2 }],
    stock: { v1: 0 },
    used: 1,
    mails: 0,
  };
  const tx = {
    order: {
      findUnique: async () => ({ status: state.order.status, stockDeducted: state.order.stockDeducted, couponCode: state.order.couponCode }),
      updateMany: async ({ where, data }) => {
        if (Object.entries(where).some(([k, v]) => state.order[k] !== v)) return { count: 0 };
        Object.assign(state.order, data);
        return { count: 1 };
      },
    },
    orderItem: { findMany: async () => state.items },
    productVariation: { update: async ({ where, data }) => { state.stock[where.id] += data.stock.increment; } },
  };
  const release = async () => { state.used -= 1; };
  // Rotanın yaptığı: transaction + yalnızca kazanan istekte e-posta
  const decide = async (approve, type = state.order.cancelReturnType) => {
    const snap = structuredClone(state);
    let r;
    try {
      r = await decideRequestInTx(tx, { orderId: "o1", type, approve, note: null }, release);
    } catch (e) {
      Object.assign(state, snap);
      throw e;
    }
    if (r.outcome === "OK") state.mails++;
    return r;
  };
  return { state, decide };
}

test("bulgu 5: iptal onayı: talep, durum, stok ve kupon birlikte; tek e-posta", async () => {
  const d = makeDb();
  assert.deepEqual(await d.decide(true), { outcome: "OK", statusChanged: true });
  assert.equal(d.state.order.cancelReturnStatus, "APPROVED");
  assert.equal(d.state.order.status, "CANCELLED");
  assert.equal(d.state.order.stockDeducted, false);
  assert.deepEqual([d.state.stock.v1, d.state.used, d.state.mails], [2, 0, 1]);
});

test("bulgu 5: çift tıklama / iki sekme: ikinci onay hiçbir şey yapmaz (çift kupon iadesi ve çift e-posta yok)", async () => {
  const d = makeDb();
  const out = await Promise.all([d.decide(true), d.decide(true)]);
  assert.deepEqual(out.map((r) => r.outcome).sort(), ["ALREADY_DECIDED", "OK"]);
  assert.deepEqual([d.state.stock.v1, d.state.used, d.state.mails], [2, 0, 1]);
  assert.equal((await d.decide(false)).outcome, "ALREADY_DECIDED", "onaylanmış talep sonradan reddedilemez");
  assert.equal(d.state.order.cancelReturnStatus, "APPROVED");
});

test("bulgu 5: talep açıldıktan sonra kargoya verilen / teslim edilen sipariş için iptal onaylanamaz; talep PENDING kalır", async () => {
  for (const status of ["SHIPPED", "DELIVERED"]) {
    const d = makeDb({ status });
    const before = structuredClone(d.state);
    await assert.rejects(d.decide(true), (e) => e instanceof RequestRefusal && /İptal talebi onaylanamaz/.test(e.message) && /hiçbir şey değiştirilmedi/.test(e.message));
    assert.deepEqual(d.state, before, "karar da geri alındı: stok/kupon iadesi ve e-posta yok");
    assert.equal((await d.decide(false)).outcome, "OK", "reddetmek mümkün");
    assert.equal(d.state.order.status, status);
  }
});

test("bulgu 5: onaylanabilir durumlar: iptal yalnızca PENDING_NEW/PENDING/READY_FOR_PICKUP, iade yalnızca DELIVERED", async () => {
  assert.deepEqual(CANCEL_APPROVABLE, ["PENDING_NEW", "PENDING", "READY_FOR_PICKUP"]);
  assert.deepEqual(RETURN_APPROVABLE, ["DELIVERED"]);
  for (const status of ORDER_STATUSES) {
    for (const [type, okList, target] of [["CANCEL", CANCEL_APPROVABLE, "CANCELLED"], ["RETURN", RETURN_APPROVABLE, "RETURNED"]]) {
      if (status === target) continue; // ayrı test
      const d = makeDb({ status, cancelReturnType: type });
      if (okList.includes(status)) {
        assert.equal((await d.decide(true)).outcome, "OK", `${type} @ ${status}`);
        assert.equal(d.state.order.status, target);
      } else {
        await assert.rejects(d.decide(true), RequestRefusal, `${type} @ ${status}`);
        assert.equal(d.state.order.status, status);
        assert.equal(d.state.order.cancelReturnStatus, "PENDING");
      }
    }
  }
});

test("bulgu 5: sipariş araya giren işlemle zaten iptal edilmişse (cron/yönetici) onay yalnızca talebi kapatır, ikinci kez iade etmez", async () => {
  const d = makeDb({ status: "CANCELLED", stockDeducted: false }); // cron iptal etti: stok ve kupon iade edilmişti
  d.state.stock.v1 = 2;
  d.state.used = 1; // aynı kuponu sonradan başka bir sipariş kullandı
  assert.deepEqual(await d.decide(true), { outcome: "OK", statusChanged: false });
  assert.equal(d.state.order.cancelReturnStatus, "APPROVED");
  assert.deepEqual([d.state.stock.v1, d.state.used], [2, 1]);
});

test("bulgu 5: iade onayı (DELIVERED → RETURNED) stok ve kuponu bir kez iade eder; ret hiçbirine dokunmaz", async () => {
  const d = makeDb({ status: "DELIVERED", cancelReturnType: "RETURN" });
  await d.decide(true);
  assert.equal(d.state.order.status, "RETURNED");
  assert.deepEqual([d.state.stock.v1, d.state.used], [2, 0]);
  const r = makeDb();
  assert.deepEqual(await r.decide(false), { outcome: "OK", statusChanged: false });
  assert.equal(r.state.order.cancelReturnStatus, "REJECTED");
  assert.equal(r.state.order.status, "PENDING");
  assert.deepEqual([r.state.stock.v1, r.state.used, r.state.mails], [0, 1, 1]);
});

test("bulgu 5: rota kararı tek transaction'da verir, e-postayı transaction dışında ve yalnızca kazanan istekte gönderir", () => {
  const src = readFileSync(new URL("../app/api/admin/order-request/route.ts", import.meta.url), "utf8");
  const tx = src.indexOf("prisma.$transaction(");
  const already = src.indexOf('result.outcome === "ALREADY_DECIDED"');
  const mail = src.indexOf("sendRequestDecisionEmail({");
  assert.ok(tx > 0 && already > tx && mail > already);
  assert.ok(!/restoreOrderStock|prisma\.order\.update\(/.test(src), "transaction dışı durum/stok yazımı kalmamalı");
  assert.match(src, /\(code\) => releaseCoupon\(code, tx\)/);
});

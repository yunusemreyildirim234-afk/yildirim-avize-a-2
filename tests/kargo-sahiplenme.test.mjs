import test from "node:test";
import assert from "node:assert/strict";
import { SHIPPABLE_STATUSES, createShippingOnce } from "../lib/shipping-claim.ts";

// Bellek içi sipariş + rotadaki koşullu güncellemelerin aynısı (app/api/admin/orders/[id]/create-shipping/route.ts)
function mk(order, opts = {}) {
  const log = { shipments: 0, mails: 0 };
  const read = { ...order }; // isteğin başta okuduğu kayıt
  const shippable = () => SHIPPABLE_STATUSES.includes(order.status);
  const deps = {
    claim: async () => {
      if (!shippable() || order.labelCreated !== read.labelCreated) return false;
      order.labelCreated = !read.labelCreated;
      return true;
    },
    open: async () => {
      await opts.duringOpen?.();
      if (opts.failOpen) throw new Error("Kargonomi hatası");
      log.shipments++;
      return { barcodeUrl: "b" };
    },
    finish: async () => {
      if (!shippable()) return false;
      Object.assign(order, { status: "SHIPPED", labelCreated: true });
      return true;
    },
    release: async () => {
      order.labelCreated = read.labelCreated;
    },
  };
  const run = async () => {
    const r = await createShippingOnce(deps);
    if (r.outcome === "OK") log.mails++;
    return r.outcome;
  };
  return { run, log };
}

test("bulgu 9: çift tıklama: tek gönderi, tek e-posta; ikinci istek sahiplenmeyi kaybeder", async () => {
  const order = { status: "PENDING", labelCreated: false };
  const a = mk(order);
  const b = mk(order); // ikisi de labelCreated=false okudu
  const [ra, rb] = await Promise.all([a.run(), b.run()]);
  assert.deepEqual([ra, rb].sort(), ["CLAIM_LOST", "OK"]);
  assert.equal(a.log.shipments + b.log.shipments, 1);
  assert.equal(a.log.mails + b.log.mails, 1);
  assert.deepEqual(order, { status: "SHIPPED", labelCreated: true });
});

test("bulgu 9: gönderi açılırken iptal edilen sipariş SHIPPED yapılmaz, e-posta gitmez", async () => {
  const order = { status: "PENDING", labelCreated: false };
  const t = mk(order, { duringOpen: async () => { order.status = "CANCELLED"; } });
  assert.equal(await t.run(), "STATUS_CHANGED");
  assert.equal(order.status, "CANCELLED");
  assert.equal(t.log.mails, 0);
});

test("bulgu 9: baştan iptal/teslim edilmiş siparişte sahiplenme olmaz, gönderi açılmaz", async () => {
  for (const status of ["CANCELLED", "RETURNED", "DELIVERED", "PENDING_NEW", "AWAITING_PAYMENT"]) {
    const t = mk({ status, labelCreated: false });
    assert.equal(await t.run(), "CLAIM_LOST", status);
    assert.equal(t.log.shipments, 0);
  }
});

test("bulgu 9: Kargonomi hata verirse sahiplenme bırakılır, yeniden denenebilir", async () => {
  const order = { status: "PENDING", labelCreated: false };
  await assert.rejects(mk(order, { failOpen: true }).run(), /Kargonomi hatası/);
  assert.deepEqual(order, { status: "PENDING", labelCreated: false });
  assert.equal(await mk(order).run(), "OK");
});

test("bulgu 9: yeniden oluşturma da tek istekle sınırlı (etiketi olan siparişte iki eşzamanlı istek)", async () => {
  const order = { status: "SHIPPED", labelCreated: true };
  const a = mk(order);
  const b = mk(order);
  const out = await Promise.all([a.run(), b.run()]);
  assert.deepEqual(out.sort(), ["CLAIM_LOST", "OK"]);
  assert.equal(a.log.shipments + b.log.shipments, 1);
  assert.deepEqual(order, { status: "SHIPPED", labelCreated: true });
});

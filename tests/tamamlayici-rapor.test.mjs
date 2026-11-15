import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./_alias-hooks.mjs", import.meta.url);
const { buildComplementReport } = await import("../lib/complement-report.ts");

const row = (over = {}) => ({ orderId: "o1", orderStatus: "DELIVERED", orderCreatedAt: new Date("2026-05-10T10:00:00Z"), quantity: 2, unitPrice: 90, bundleMainProductId: "A", bundleDiscount: 20, complementProductId: "C", ...over });

test("tek kalem: liste = net + indirim, adet ve sipariş sayısı", () => {
  const r = buildComplementReport([row()]);
  assert.deepEqual(r.summary, { quantity: 2, orders: 1, list: 200, discount: 20, net: 180 });
  assert.equal(r.byMain[0].id, "A");
  assert.equal(r.byMain[0].items[0].complementId, "C");
  assert.equal(r.byComplement[0].items[0].mainId, "A");
  assert.equal(r.excludedOrders, 0);
});

test("iptal, iade, ödenmemiş, ödeme başarısız ve onay bekleyen Havale hariç; hariç sipariş sayısı verilir", () => {
  const rows = ["CANCELLED", "RETURNED", "AWAITING_PAYMENT", "PAYMENT_FAILED", "PENDING_NEW"].map((s, i) => row({ orderId: `x${i}`, orderStatus: s }));
  rows.push(row({ orderId: "x0", orderStatus: "CANCELLED", complementProductId: "D" })); // aynı sipariş iki kalem: bir kez sayılır
  rows.push(row({ orderId: "ok", orderStatus: "PENDING" }));
  const r = buildComplementReport(rows);
  assert.equal(r.summary.orders, 1);
  assert.equal(r.summary.quantity, 2);
  assert.equal(r.excludedOrders, 5);
});

test("NULL kalemler (bağsız, indirimi boş) rapora ve hariç sayısına girmez", () => {
  const r = buildComplementReport([row({ bundleMainProductId: null, bundleDiscount: null }), row({ bundleDiscount: null }), row({ bundleMainProductId: null, orderStatus: "CANCELLED" })]);
  assert.equal(r.summary.quantity, 0);
  assert.equal(r.byMain.length, 0);
  assert.equal(r.excludedOrders, 0);
});

test("tarih: sipariş oluşturulma tarihine göre; aralık dışı girmez, bitiş hariçtir", () => {
  const range = { start: Date.parse("2026-05-01T00:00:00Z"), end: Date.parse("2026-06-01T00:00:00Z") };
  const rows = [
    row({ orderId: "in" }),
    row({ orderId: "before", orderCreatedAt: "2026-04-30T23:59:59Z" }),
    row({ orderId: "edge", orderCreatedAt: "2026-06-01T00:00:00Z" }),
    row({ orderId: "cancelledOut", orderStatus: "CANCELLED", orderCreatedAt: "2026-07-01T00:00:00Z" }),
  ];
  const r = buildComplementReport(rows, range);
  assert.equal(r.summary.orders, 1);
  assert.equal(r.excludedOrders, 0); // aralık dışındaki iptal hariç sayısına da girmez
  assert.equal(buildComplementReport(rows, null).summary.orders, 3);
});

test("havale sonradan onaylanınca (durum sayılan olunca) verildiği ayın raporunda görünür", () => {
  const range = { start: Date.parse("2026-05-01T00:00:00Z"), end: Date.parse("2026-06-01T00:00:00Z") };
  const placed = row({ orderId: "h", orderCreatedAt: "2026-05-31T20:00:00Z", orderStatus: "PENDING_NEW" });
  assert.equal(buildComplementReport([placed], range).summary.orders, 0);
  assert.equal(buildComplementReport([placed], range).excludedOrders, 1);
  assert.equal(buildComplementReport([{ ...placed, orderStatus: "PENDING" }], range).summary.orders, 1);
});

test("gruplama: ana → tamamlayıcılar, ters görünüm, sipariş sayısı tekil, indirime göre sıralı", () => {
  const rows = [
    row({ orderId: "o1", complementProductId: "C", quantity: 1, bundleDiscount: 10, unitPrice: 90 }),
    row({ orderId: "o1", complementProductId: "D", quantity: 1, bundleDiscount: 5, unitPrice: 45 }),
    row({ orderId: "o2", complementProductId: "C", quantity: 3, bundleDiscount: 30, unitPrice: 90 }),
    row({ orderId: "o3", bundleMainProductId: "B", complementProductId: "C", quantity: 1, bundleDiscount: 10, unitPrice: 90 }),
  ];
  const r = buildComplementReport(rows);
  assert.deepEqual(r.byMain.map((g) => [g.id, g.quantity, g.orders, g.discount]), [["A", 5, 2, 45], ["B", 1, 1, 10]]);
  assert.deepEqual(r.byMain[0].items.map((i) => [i.complementId, i.quantity, i.orders, i.net]), [["C", 4, 2, 360], ["D", 1, 1, 45]]);
  const c = r.byComplement.find((g) => g.id === "C");
  assert.equal(c.quantity, 5);
  assert.equal(c.orders, 3);
  assert.deepEqual(c.items.map((i) => i.mainId), ["A", "B"]);
  assert.equal(r.summary.orders, 3);
});

test("silinmiş ana ürün: kimlik olduğu gibi gruplanır (ad çözümü çağıranın işi)", () => {
  const r = buildComplementReport([row({ bundleMainProductId: "silinmis-id" })]);
  assert.equal(r.byMain[0].id, "silinmis-id");
  assert.equal(r.byMain[0].discount, 20);
});

test("kuruş yuvarlama: kayan nokta artığı iki ondalığa indirilir", () => {
  const r = buildComplementReport([row({ quantity: 3, unitPrice: 33.33, bundleDiscount: 0.1 }), row({ orderId: "o2", quantity: 1, unitPrice: 0.2, bundleDiscount: 0.2 })]);
  assert.equal(r.summary.net, 100.19);
  assert.equal(r.summary.discount, 0.3);
});

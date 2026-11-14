import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { CUSTOMER_ORDER_SELECT, CUSTOMER_ORDER_LIMIT, shapeCustomerOrder } = await import("../lib/customer.ts");

test("müşteri sipariş select'inde yönetici/iç alanlar yok; son 20 sipariş", () => {
  for (const k of ["shippingPrice", "kargonomiShipmentId", "labelCreated", "abandonedEmailSent", "receiptReminderSent", "barcodeUrl", "shippingBarcode", "stockDeducted", "phone", "taxNumber", "taxOffice", "companyTitle", "orderNote", "packageDesi", "userId", "recipientName"]) {
    assert.equal(k in CUSTOMER_ORDER_SELECT, false, k);
  }
  for (const k of ["id", "status", "totalAmount", "items", "shippingTrackingCode", "receiptUrl", "kargonomiStatusLabel", "cancelReturnStatus", "address", "createdAt", "updatedAt"]) assert.equal(k in CUSTOMER_ORDER_SELECT, true, k);
  assert.equal(CUSTOMER_ORDER_LIMIT, 20);
});

test("shapeCustomerOrder: ürün yalnız id/başlık/kapak olarak gider", () => {
  const o = shapeCustomerOrder({
    id: "o1",
    items: [{ id: "i1", quantity: 2, unitPrice: 10, variation: { id: "v", variationValue: "Gold", product: { id: "p", title: "Avize", imageUrl: "/a.jpg", images: ["/g.jpg"], variations: [{ images: ["/c.jpg"] }] } } }],
  });
  assert.deepEqual(Object.keys(o.items[0].variation.product).sort(), ["id", "imageUrl", "title"]);
  assert.equal(o.items[0].quantity, 2);
});

import test from "node:test";
import assert from "node:assert/strict";
import { orderItemProductView } from "../lib/order-item-product.ts";

test("ürün yoksa (silinmiş) çökmez, boş görünüm döner", () => {
  assert.deepEqual(orderItemProductView(null), { title: null, image: null, href: null });
  assert.deepEqual(orderItemProductView(undefined), { title: null, image: null, href: null });
});

test("görsel sırası: imageUrl, yoksa images[0]", () => {
  assert.equal(orderItemProductView({ id: "p1", title: "A", imageUrl: "/api/product-images/x", images: ["/b.jpg"] }).image, "/api/product-images/x");
  assert.equal(orderItemProductView({ id: "p1", title: "A", imageUrl: null, images: ["/b.jpg"] }).image, "/b.jpg");
  assert.equal(orderItemProductView({ id: "p1", title: "A", imageUrl: "", images: [] }).image, null);
});

test("ad ve bağlantı", () => {
  const v = orderItemProductView({ id: "p1", title: "  Kristal Avize ", images: [] });
  assert.equal(v.title, "Kristal Avize");
  assert.equal(v.href, "/urun/p1");
});

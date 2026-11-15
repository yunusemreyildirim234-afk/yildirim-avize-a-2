import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { orderItemProductView } = await import("../lib/order-item-product.ts");

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
  assert.equal(v.href, "/urun/kristal-avize-p1"); // okunur adres: ad + kimliğin ilk 8 karakteri
  assert.equal(orderItemProductView({ id: "p1", title: "", images: [] }).href, "/urun/p1"); // başlık yoksa eski adres (308 ile düzelir)
});

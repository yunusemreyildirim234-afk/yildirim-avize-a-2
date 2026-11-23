import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { project, selectedLeaves } from "./_select-projection.mjs";

// DAVRANIŞ (okuma): getConfirmationOrder GERÇEK kodla çalışır; sahte depo select/include'u Prisma gibi uygular.
// Kural: sipariş onay okuması ürün için yalnız sayfada kullanılan alanları çeker (açıklama, fiyat, Trendyol alanları gelmez) ve sayfa için yeterlidir.
register("./_hooks-davranis.mjs", import.meta.url);
const { getConfirmationOrder } = await import("../lib/order-confirmation.ts");

const fullOrder = {
  id: "o1", status: "PENDING", totalAmount: 1100, createdAt: new Date(0),
  user: { name: "Ali", password: "scrypt$x", email: "ali@example.com", twoFactorSecret: "GIZLI" },
  items: [{
    id: "i1", quantity: 2, unitPrice: 550, productTitle: "Kayıtlı Başlık", variationLabel: "Gold", orderId: "o1", variationId: "v1",
    variation: { id: "v1", variationValue: "Gold", stock: 9, extraPrice: 0, product: { id: "p1", title: "Avize", category: "Salon", imageUrl: "/a.jpg", images: ["/g.jpg"], description: "UZUN", basePrice: 500, syncSnapshot: { z: 1 }, variations: [{ images: ["/r.jpg"], position: 0, stock: 4 }] } },
  }],
};
let args;
globalThis.__fakePrisma = { order: { findUnique: async (a) => (args = a, project(fullOrder, a)) } };

test("onay okuması: ürün yalnız dar alanlarla gelir, ağır/gizli alanlar okunmaz; sayfanın ihtiyacı karşılanır", async () => {
  const o = await getConfirmationOrder("o1");
  const p = o.items[0].variation.product;
  assert.deepEqual(Object.keys(p).sort(), ["category", "id", "imageUrl", "images", "title", "variations"]);
  assert.deepEqual(p.variations, [{ images: ["/r.jpg"] }]);
  assert.equal(p.description, undefined);
  assert.equal(p.syncSnapshot, undefined);
  // kalem alanları ve sahip kontrolü için kullanıcı alanları yerinde
  assert.equal(o.items[0].quantity, 2);
  assert.equal(o.items[0].unitPrice, 550);
  assert.equal(o.user.name, "Ali");
  assert.equal(o.user.password, "scrypt$x"); // misafir hesabı ayrımı için (sayfa kullanır); kullanıcı yalnız { name, password }
  assert.equal(o.user.email, undefined);
  assert.equal(o.user.twoFactorSecret, undefined);
});

test("onay okuması: ürün için include yok (select'in içinde); tek findUnique", async () => {
  args = null;
  await getConfirmationOrder("o2");
  assert.deepEqual(args.where, { id: "o2" });
  assert.ok(!selectedLeaves(args.include.items).has("description"));
  assert.equal(JSON.stringify(args.include.items).includes('"include"'), false);
});

// KALAN KAYNAK DENETİMİ: layout/sayfa Next sunucu bileşenleridir (React cache aynı istekte ancak sunucuda paylaşılır), dışarıdan çalıştırılamaz.
test("[kaynak] layout ve sayfa aynı okuma işlevini kullanır; sayfa doğrudan prisma çağırmaz; 24 saat misafir kuralı yerinde", () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  assert.match(read("app/siparis-onay/[id]/layout.tsx"), /getConfirmationOrder\(id\)/);
  const page = read("app/siparis-onay/[id]/page.tsx");
  assert.match(page, /getConfirmationOrder\(id\)/);
  assert.doesNotMatch(page, /prisma\./);
  assert.match(page, /canViewOrderDetails\(/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("sipariş onay: layout ve sayfa tek okuma paylaşır, ürün alanları dar", () => {
  const lib = read("lib/order-confirmation.ts");
  assert.match(lib, /cache\(\(id: string\)/);
  assert.match(lib, /product: \{ select: \{ id: true, title: true, category: true, imageUrl: true, images: true/);
  assert.doesNotMatch(lib, /product: \{ include/);
  assert.match(read("app/siparis-onay/[id]/layout.tsx"), /getConfirmationOrder\(id\)/);
  const page = read("app/siparis-onay/[id]/page.tsx");
  assert.match(page, /getConfirmationOrder\(id\)/);
  assert.doesNotMatch(page, /prisma\./);
  assert.match(page, /canViewOrderDetails\(/); // 24 saat misafir kuralı yerinde
});

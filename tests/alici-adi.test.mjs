import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recipientOf, recipientDiffers, recipientLabel } from "../lib/recipient.ts";

const o = (recipientName, name = "Ayşe Yılmaz") => ({ recipientName, user: { name } });

test("recipientOf: alıcı adı varsa o; null/boş/boşluk (eski siparişler) hesap adı", () => {
  assert.equal(recipientOf(o("Mehmet Kaya")), "Mehmet Kaya");
  assert.equal(recipientOf(o("  Mehmet Kaya  ")), "Mehmet Kaya");
  for (const v of [null, undefined, "", "   "]) assert.equal(recipientOf(o(v)), "Ayşe Yılmaz");
  assert.equal(recipientOf({ user: { name: "Ayşe Yılmaz" } }), "Ayşe Yılmaz"); // alan hiç yok
});

test("recipientDiffers / recipientLabel: yalnızca gerçekten farklıysa etiket", () => {
  assert.equal(recipientDiffers(o("Mehmet Kaya")), true);
  assert.equal(recipientDiffers(o(null)), false);
  assert.equal(recipientDiffers(o("ayşe  yılmaz")), false); // boşluk/harf farkı
  assert.equal(recipientDiffers(o("AYŞE YILMAZ")), false); // Türkçe büyük harf
  assert.equal(recipientLabel(o("Mehmet Kaya")), "Alıcı: Mehmet Kaya (sipariş veren: Ayşe Yılmaz)");
  assert.equal(recipientLabel(o(null)), "Ayşe Yılmaz");
  assert.equal(recipientLabel(o("Ayşe Yılmaz")), "Ayşe Yılmaz");
});

test("şema ve SQL: yalnızca Order.recipientName String? ve IF NOT EXISTS'li nullable kolon", () => {
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  assert.equal((schema.match(/recipientName/g) ?? []).length, 1);
  const order = schema.slice(schema.indexOf("model Order {"), schema.indexOf("model OrderItem"));
  assert.match(order, /recipientName\s+String\?/);
  const sql = readFileSync(new URL("../prisma/sql/alici-adi-ekle.sql", import.meta.url), "utf8");
  const stmts = sql.split("\n").filter((l) => l.trim() && !l.startsWith("--"));
  assert.deepEqual(stmts, ['ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "recipientName" TEXT;']);
  assert.match(sql, /SQL ONCE/);
});

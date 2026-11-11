import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("sipariş kaydı: form adı Order.recipientName'e yazılır (tek yerde, order.create içinde)", () => {
  const s = src("app/api/order/route.ts");
  assert.equal((s.match(/recipientName: name,/g) ?? []).length, 1);
  const create = s.slice(s.indexOf("return tx.order.create({"), s.indexOf("items: {", s.indexOf("return tx.order.create({")));
  assert.match(create, /phone,\s+address,\s+recipientName: name,/);
  // misafir kullanıcı oluşturma ve PayTR adı eskisi gibi
  assert.match(s, /prisma\.user\.create\(\{ data: \{ name, email: guestEmail/);
  assert.match(s, /userName: name,/);
});

test("Aras: buyer_name = recipientOf(order); e-posta hesap adresinden, telefon/adres sipariş alanlarından", () => {
  const s = src("lib/kargonomi.ts");
  assert.match(s, /buyer_name: recipientOf\(order\)/);
  assert.ok(!/buyer_name: order\.user\.name/.test(s));
  assert.match(s, /buyer_email: cleanGuestEmail\(order\.user\.email\)/);
  assert.match(s, /buyer_phone: \(order\.phone/);
  assert.match(s, /buyer_address: order\.address/);
  assert.match(s, /import \{ recipientOf \} from "@\/lib\/recipient"/);
});

test("yönetici bildirimi ve e-postası alıcıyı gösterir; müşteriye giden 'Sayın' hitabı hesap adıyla kalır", () => {
  const o = src("lib/orders.ts");
  assert.match(o, /message: `\$\{recipientLabel\(order\)\} • /);
  assert.match(o, /customerName: order\.user\.name,/);
  assert.match(o, /recipientName: recipientOf\(order\),/);
  const e = src("lib/email.ts");
  assert.match(e, /Sayın \$\{esc\(data\.customerName\)\}/);
  assert.match(e, /recipientDiffers\(\{ recipientName: data\.recipientName, user: \{ name: data\.customerName \} \}\)/);
  // fatura e-postası hesap adıyla
  assert.match(src("app/api/admin/orders/[id]/invoice/route.ts"), /name: order\.user\.name,/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFis } from "../lib/admin-order-detail.ts";
import { matchesOrderSearch } from "../lib/admin-order-search.ts";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const base = { id: "abcdef12-3456-7890", createdAt: new Date("2026-11-10T09:00:00Z"), shippingType: "STANDART_KARGO", phone: "0555 111 22 33", address: "Ataşehir", items: [{ quantity: 1, variationValue: "Altın", title: "Avize" }] };

test("hazırlık fişi: alıcı adı ≠ hesap adı → fişte alıcı; eski sipariş (null) → hesap adı; sahip bilgisi yoksa alan yok", () => {
  assert.equal(buildFis({ ...base, recipientName: "Mehmet Kaya", user: { name: "Ayşe Yılmaz" } }, "Mağaza").recipient, "Mehmet Kaya");
  assert.equal(buildFis({ ...base, recipientName: null, user: { name: "Ayşe Yılmaz" } }, "Mağaza").recipient, "Ayşe Yılmaz");
  assert.ok(!("recipient" in buildFis(base, "Mağaza")));
  assert.ok(!/price|fiyat|total|toplam|discount/i.test(JSON.stringify(buildFis({ ...base, recipientName: "X", user: { name: "Y" } }, "Mağaza"))));
});

test("admin araması alıcı adını da bulur; eski siparişte (alan yok/null) hesap adıyla çalışmaya devam eder", () => {
  const o = { id: "abcdef12-3456", phone: null, recipientName: "Mehmet Kaya", user: { name: "Ayşe Yılmaz", email: "a@b.com" } };
  assert.equal(matchesOrderSearch(o, "mehmet kaya"), true);
  assert.equal(matchesOrderSearch(o, "MEHMET"), true);
  assert.equal(matchesOrderSearch(o, "ayşe"), true); // hesap adı da
  assert.equal(matchesOrderSearch(o, "veli"), false);
  const old = { id: "abcdef12-3456", user: { name: "Ayşe Yılmaz", email: "a@b.com" } };
  assert.equal(matchesOrderSearch(old, "ayşe yılmaz"), true);
  assert.equal(matchesOrderSearch({ ...old, recipientName: null }, "ayşe"), true);
});

test("görünümler: admin liste/detay 'Alıcı: X (sipariş veren: Y)', fiş, takip ve onay sayfası maskeli alıcı, bildirim zili", () => {
  const list = src("app/admin/page.tsx");
  assert.match(list, /recipientDiffers\(order\) && <span data-testid="alici-adi"[^>]*>\{recipientLabel\(order\)\}/);
  const detail = src("app/admin/siparis/[id]/page.tsx");
  assert.match(detail, /recipientDiffers\(order\) && \(\s*<p data-testid="alici-adi"[^>]*>\{recipientLabel\(order\)\}/);
  assert.match(detail, /fis\.recipient && <p className="mt-3 text-sm"><strong>Alıcı:<\/strong> \{fis\.recipient\}/);
  const track = src("app/kargo-takip/page.tsx");
  assert.match(track, /maskName\(recipientOf\(order\)\)/);
  assert.match(track, /recipientName: true,/);
  const ok = src("app/siparis-onay/[id]/page.tsx");
  assert.match(ok, /Alıcı: <strong>\{maskName\(recipientOf\(order\)\)\}/);
  assert.match(ok, /Sayın <strong>\{maskName\(order\.user\.name\)\}/); // hitap hesap adıyla
  const bell = src("app/api/admin/notifications/route.ts");
  assert.match(bell, /recipientName: true/);
  assert.match(bell, /customer: recipientLabel\(o\)/);
});

test("hesap e-postaları (kargolandı, dekont hatırlatma, iptal, hatırlatma) ve fatura hesap adıyla kalır", () => {
  assert.match(src("app/api/admin/order-status/route.ts"), /sendShippedEmail\(\{[^}]*name: user\.name/);
  assert.match(src("app/api/cron/reminders/route.ts"), /name: o\.user\.name/);
  assert.ok(!/recipient/.test(src("app/api/cron/reminders/route.ts")));
  assert.ok(!/recipient/.test(src("app/api/admin/orders/[id]/invoice/route.ts")));
});

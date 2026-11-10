import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkDeleteCount, deleteButtonLabel, deleteConfirmText, describeFilters, isDeleteConfirmed } from "../lib/bulk-delete.ts";
import { adminOrderHref } from "../lib/admin-order-detail.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const none = { dateActive: false };

test("yönetici bildirimleri sipariş detay sayfasına gider (orders.ts ve PayTR callback; yalnızca bağlantı metni)", () => {
  const orders = read("../lib/orders.ts");
  assert.match(orders, /title: `Stok yetersiz: #\$\{orderId\.slice\(0, 8\)\}`[\s\S]{0,300}link: adminOrderHref\(orderId\)/);
  assert.match(orders, /title: `Yeni Sipariş: #\$\{order\.id\.slice\(0, 8\)\}`[\s\S]{0,400}link: adminOrderHref\(order\.id\)/);
  assert.ok(!orders.includes('link: "/admin#siparisler"'));
  const cb = read("../app/api/paytr/callback/route.ts");
  assert.match(cb, /Eksik ödeme uyarısı[\s\S]{0,400}link: adminOrderHref\(orderId\)/);
  assert.ok(!cb.includes('"/admin#siparisler"'));
  assert.equal(adminOrderHref("abc-123"), "/admin/siparis/abc-123");
  assert.ok(read("../e2e/tests/orders/p-siparis.spec.ts").includes("`/admin/siparis/${mainOrderId}`"), "e2e beklentisi güncel");
});

test("yazılı onay: yalnızca SİL (büyük/küçük, i/ı farkı gözetilmez); boş ve başka metin reddedilir", () => {
  for (const ok of ["SİL", "sil", "Sil", " SIL ", "sıl"]) assert.equal(isDeleteConfirmed(ok), true, ok);
  for (const bad of ["", " ", null, undefined, "evet", "SİLİ", "S İL", "delete"]) assert.equal(isDeleteConfirmed(bad), false, String(bad));
});

test("düğme etiketi: arama ya da tarih açıkken 'Filtrelenen', değilse 'Listelenen'", () => {
  assert.equal(deleteButtonLabel(5, none), "Listelenen 5 siparişi sil");
  assert.equal(deleteButtonLabel(5, { q: "  ", dateActive: false }), "Listelenen 5 siparişi sil");
  assert.equal(deleteButtonLabel(5, { q: "ayşe", dateActive: false }), "Filtrelenen 5 siparişi sil");
  assert.equal(deleteButtonLabel(2, { dateActive: true }), "Filtrelenen 2 siparişi sil");
});

test("onay metni: sayı ile durum, arama ve tarih süzgeçleri yazılır", () => {
  assert.equal(describeFilters({ ...none, durum: "tumu" }), "Durum: Tümü • Arama: yok • Tarih: tüm zamanlar");
  assert.match(describeFilters(none), /Durum: Yeni gelen, Teslime hazır, Kargo sürecinde, Talep bekleyen/);
  const t = deleteConfirmText(7, { durum: "iptal", q: "ayşe", tarih: "ozel", bas: "2026-11-01", bit: "2026-11-05", dateActive: true });
  assert.match(t, /^7 sipariş/);
  for (const s of ["Durum: İptal", 'Arama: "ayşe"', "Tarih: Özel aralık (2026-11-01 – 2026-11-05)"]) assert.ok(t.includes(s), s);
  assert.match(describeFilters({ tarih: "bugun", dateActive: true }), /Tarih: Bugün/);
  assert.match(describeFilters({ tarih: "bugun", dateActive: false }), /tüm zamanlar/, "geçersiz tarih süzmediyse yazılmaz");
});

test("sunucu sayı denetimi: sayılar eşleşmezse reddedilir; çoklu silmede sayı şart, tekte değil", () => {
  assert.equal(checkDeleteCount({ requested: 3, expected: 3, found: 3 }), null);
  assert.match(checkDeleteCount({ requested: 3, expected: 3, found: 2 }), /Liste değişmiş.*Hiçbir sipariş silinmedi/, "bir sipariş bu arada silinmiş");
  assert.match(checkDeleteCount({ requested: 3, expected: 2, found: 3 }), /Liste değişmiş/);
  assert.match(checkDeleteCount({ requested: 600, expected: 500, found: 500 }), /Liste değişmiş/, "500 üstü sessizce kesilmez");
  for (const bad of ["3", 3.5, NaN, {}]) assert.ok(checkDeleteCount({ requested: 3, expected: bad, found: 3 }), String(bad));
  assert.match(checkDeleteCount({ requested: 2, expected: undefined, found: 2 }), /sayısı gönderilmedi/);
  assert.equal(checkDeleteCount({ requested: 1, expected: undefined, found: 1 }), null);
});

test("uç ve arayüz: sayı denetimi silmeden önce; 2 saatlik ödeme bekleyen koruması aynen; düğme SİL yazdırır", () => {
  const route = read("../app/api/admin/orders/route.ts");
  const del = route.slice(route.indexOf("async function DELETEHandler"));
  assert.ok(del.indexOf("await adminGuard()") < del.indexOf("checkDeleteCount"));
  assert.ok(del.indexOf("checkDeleteCount") < del.indexOf("isPaymentInFlight"), "sayı denetimi ödeme koruması ve silmeden önce");
  assert.ok(del.indexOf("checkDeleteCount") < del.indexOf("prisma.$transaction"));
  assert.match(del, /const inFlight = existing\.filter\(\(o\) => isPaymentInFlight\(o, Date\.now\(\)\)\)/);
  assert.match(del, /status: 409/);
  const rules = read("../lib/stock-rules.ts");
  assert.match(rules, /DELETE_GUARD_HOURS\s*=\s*2/, "son 2 saat kuralı değişmedi");
  const btn = read("../components/AdminDeleteButton.tsx");
  assert.match(btn, /prompt\(/);
  assert.match(btn, /isDeleteConfirmed\(typed\)/);
  assert.match(btn, /expectedCount === undefined \? \{ ids \} : \{ ids, expectedCount \}/);
  const page = read("../app/admin/page.tsx");
  assert.match(page, /expectedCount=\{visibleOrders\.length\}\s+typeToConfirm/);
  assert.match(page, /label=\{deleteButtonLabel\(visibleOrders\.length, bulkFilters\)\}/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(f, import.meta.url), "utf8");

test("OrderStatusSelector: SHIPPED onayı e-postayı belirtir, DELIVERED yalnız site içi", () => {
  const src = read("../components/OrderStatusSelector.tsx");
  assert.match(src, /SHIPPED: "[^"]*takip kodu varsa e-posta da gönderilecek/);
  assert.match(src, /DELIVERED: "[^"]*\(e-posta gitmez\)/);
  assert.doesNotMatch(src, /SHIPPED: "[^"]*e-posta gitmez/);
});

test("barkod rotası: hazır değil mesajı, durum 502", () => {
  const src = read("../app/api/admin/kargonomi/barcode/route.ts");
  assert.match(src, /Barkod henüz hazır değil olabilir \(Kargonomi gönderiyi işleme alıyor\)\. Birkaç dakika sonra tekrar deneyin\./);
  assert.doesNotMatch(src, /Barkod verisi çözümlenemedi/);
  assert.match(src, /status: 502/);
});

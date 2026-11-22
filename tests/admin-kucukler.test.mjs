import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("sipariş detayı: onaylı havale dekontsuz metni", () => {
  const s = src("app/admin/siparis/[id]/page.tsx");
  assert.match(s, /bankApproved \? \(\r?\n\s*"Ödeme onaylandı \(dekontsuz\)"/);
});
test("ödeme kartı başlıkları", () => {
  const s = src("components/AdminPayoutCard.tsx");
  assert.match(s, /Bekleyen kart yatışları/);
  assert.match(s, /PayTR → Kuveyt Türk hesabı · tahmini/);
  assert.doesNotMatch(s, /Kartlı ödemeler \(Kuveyt Türk\)/);
});
test("Renk Ekle: görünür Stok / Ek fiyat etiketleri, aria-label korunur", () => {
  const s = src("components/AdminProductEditor.tsx");
  assert.match(s, /<label[^>]*>\r?\n\s*Stok\r?\n\s*<input aria-label="Stok"/);
  assert.match(s, /Ek fiyat \(₺\)\r?\n\s*<input aria-label="Ek fiyat"/);
});
test("⋯ menüsü: Escape kapatır ve odağı düğmeye döndürür", () => {
  const s = src("components/AdminProductList.tsx");
  assert.match(s, /e\.key !== "Escape"/);
  assert.match(s, /querySelector\("summary"\)\?\.focus\(\)/);
});

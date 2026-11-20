import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const zoom = readFileSync(new URL("../components/ImageZoom.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../components/ProductDetailClient.tsx", import.meta.url), "utf8");

test("ürün ana görseli ve büyüteç kesmez: object-contain, beyaz zemin", () => {
  const main = zoom.slice(zoom.indexOf("export function HoverMagnifier"), zoom.indexOf("const MIN"));
  assert.ok(!main.includes("object-cover"));
  assert.equal((main.match(/object-contain/g) ?? []).length, 2);
  assert.match(main, /shadow-xl bg-white/);
});

test("ana fotoğraf kutusu kare (aspect-square), esnemez; sol sütun masaüstünde üste hizalı ve sticky", () => {
  assert.match(detail, /relative aspect-square w-full overflow-hidden flex items-center justify-center bg-white/);
  assert.ok(!detail.includes("flex-1 overflow-hidden flex items-center justify-center"), "kutu flex-1 ile esnememeli");
  assert.ok(!detail.includes("min-h-[320px] sm:min-h-[440px]"), "sabit min yükseklik kalmamalı");
  assert.match(detail, /grid grid-cols-1 lg:grid-cols-2 lg:items-start/); // sağ sütun uzasa da sol sütun uzamaz/ortalanmaz
  assert.match(detail, /overflow-clip/); // overflow-hidden sticky'yi bozar
  assert.match(detail, /bg-neutral-900 lg:sticky lg:top-24/); // Navbar h-20 (80px) + pay
});

test("küçük resim şeridi kare kutunun hemen altında", () => {
  const kutu = detail.indexOf("aspect-square w-full overflow-hidden");
  const serit = detail.indexOf('role="tablist"');
  assert.ok(kutu > 0 && serit > kutu);
});

test("ürün kartı görsel alanı kare (aspect-square), object-contain; 4:5 değil", () => {
  const card = readFileSync(new URL("../components/CardImages.tsx", import.meta.url), "utf8");
  assert.equal((card.match(/relative aspect-square bg-photo/g) ?? []).length, 2); // tek ve çok görselli dal
  assert.ok(!card.includes("aspect-[4/5]"));
  assert.ok(!card.includes("object-cover"));
});

test("kart hover büyümesi tüm slaytlarda ortak sınıfla (motion-safe), slayt kutusu kırpar", () => {
  const card = readFileSync(new URL("../components/CardImages.tsx", import.meta.url), "utf8");
  assert.match(card, /const IMG = ".*motion-safe:group-hover:scale-\[1\.03\]"/);
  assert.equal((card.match(/className=\{IMG\}/g) ?? []).length, 2); // ilk görsel (tek/çok görselli) + sonraki slaytlar
  assert.ok(!/group-hover:scale-\[1\.03\]/.test(card.replace(/const IMG = .*\n/, "")), "büyüme sınıfı tek yerde tanımlı");
  assert.ok((card.match(/snap-center overflow-hidden/g) ?? []).length >= 2);
});

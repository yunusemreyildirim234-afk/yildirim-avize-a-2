import test from "node:test";
import assert from "node:assert/strict";
import { kalkanPlani, etiketCoz, elleDegisti, KAPALI_METIN, YOK_METIN } from "../lib/trendyol-kalkan.ts";
import { GROUPS } from "../lib/trendyol-plan.ts";

const ayar = (stock = "KEEP") => Object.fromEntries(GROUPS.map((g) => [g, g === "STOCK" ? stock : "KEEP"]));
const ev = (id, barcode, value, stock, syncStock = stock, stockCode = null) => ({ id, barcode, variationValue: value, extraPrice: 0, stock, stockCode, salePrice: 100, listPrice: null, syncStock, syncSnapshot: null });
const iv = (barcode, value, stockCode = null) => ({ barcode, variationValue: value, extraPrice: 0, stock: 5, stockCode, salePrice: 100, listPrice: null });
const prod = (variations, n = 1) => ({ id: `p${n}`, trendyolMainId: `M${n}`, title: `Ürün ${n}`, description: null, category: "Kristal", basePrice: 100, listPrice: null, images: [], active: true, brand: null, trendyolCategory: null, trendyolUrl: null, syncSnapshot: null, variations });
const inc = (variations, n = 1) => ({ mainId: `M${n}`, title: `Ürün ${n}`, description: null, category: "Kristal", basePrice: 100, listPrice: null, images: [], active: true, brand: null, trendyolCategory: null, trendyolUrl: null, variations });
const run = (mevcut, gelen, kapali = [], rezerve = {}, a = ayar()) => kalkanPlani(mevcut, gelen, new Set(kapali), rezerve, a);

test("kapalı (KESİN) ile listede yok (ZAYIF) ayrılır ve satır metinleri tam", () => {
  const p = prod([ev("a", "B1", "Krom", 5), ev("b", "B2", "Altın", 2), ev("c", "B3", "Gümüş", 4), ev("d", "B4", "Bakır", 4), ev("e", "B5", "Siyah", 4), ev("f", "B6", "Beyaz", 4), ev("g", "B7", "Mavi", 4), ev("h", "B8", "Kırmızı", 4), ev("i", "B9", "Yeşil", 4), ev("j", "B10", "Sarı", 4), ev("k", "B11", "Mor", 4), ev("l", "B12", "Gri", 4)]);
  const g = inc(p.variations.slice(2).map((v) => iv(v.barcode, v.variationValue)));
  const s = run([p], [g], ["B1"]);
  const [k, z] = s.urunler[0].varyasyonlar;
  assert.equal(k.guven, "KESIN"); assert.equal(k.metin, KAPALI_METIN);
  assert.equal(z.guven, "ZAYIF"); assert.equal(z.metin, YOK_METIN);
});

test("barkodsuz varyasyon ve Trendyol'da olmayan ürün atlanır", () => {
  const p = prod([ev("a", null, "Elle", 5), ev("b", "B2", "Altın", 5)]);
  assert.equal(run([p], [inc([iv("B2", "Altın")])]).toplam, 0);
  assert.equal(run([p], []).toplam, 0);
  assert.equal(run([{ ...p, trendyolMainId: null }], [inc([])]).toplam, 0);
});

test("ürün eşiği: 4 varyasyondan 3'ü kalkan = şüpheli; 2'si kalkan = değil", () => {
  const vs = [ev("a", "B1", "A", 3), ev("b", "B2", "B", 3), ev("c", "B3", "C", 3), ev("d", "B4", "D", 3)];
  assert.equal(run([prod(vs)], [inc([iv("B4", "D")])]).urunler[0].suphe, true); // 3/4
  assert.equal(run([prod(vs)], [inc([iv("B4", "D"), iv("B3", "C")])]).urunler[0].suphe, false); // 2/4: 3'ün altında
  const vs8 = Array.from({ length: 8 }, (_, i) => ev(`v${i}`, `B${i}`, `R${i}`, 3));
  assert.equal(run([prod(vs8)], [inc([iv("B7", "R7"), iv("B6", "R6"), iv("B5", "R5"), iv("B4", "R4")])]).urunler[0].suphe, false); // 4/8: yarıyı aşmaz
  assert.equal(run([prod(vs8)], [inc([iv("B7", "R7"), iv("B6", "R6"), iv("B5", "R5")])]).urunler[0].suphe, true); // 5/8
});

test("genel eşik: kalkan > eşleşenin %10'u uyarı verir", () => {
  const many = Array.from({ length: 20 }, (_, i) => prod([ev(`v${i}`, `B${i}`, "Std", 3)], i));
  const gelen = many.slice(0, 20).map((p, i) => inc(i < 17 ? p.variations.map((v) => iv(v.barcode, v.variationValue)) : [iv(`X${i}`, "Başka")], i));
  const s = run(many, gelen); // 3 kalkan / 17 eşleşen > %10
  assert.equal(s.kalkanToplam, 3); assert.equal(s.eslesen, 17); assert.equal(s.genelUyari, true);
  const tek = run(many, many.map((p, i) => inc(i === 0 ? [iv("X", "Y")] : p.variations.map((v) => iv(v.barcode, v.variationValue)), i)));
  assert.equal(tek.genelUyari, false); // 1/19 < %10
});

test("elle değişmiş: satış syncStock'u düşürmez → stock<syncStock işaretsiz; stock>syncStock ELLE", () => {
  assert.equal(elleDegisti(3, 5), false); // satış
  assert.equal(elleDegisti(5, 5), false);
  assert.equal(elleDegisti(8, 5), true); // elle artırma
  assert.equal(elleDegisti(2, null), true); // eşitleme kaydı yok
  const p = prod([ev("a", "B1", "Krom", 3, 5), ev("b", "B2", "Altın", 8, 5), ev("c", "B3", "Gümüş", 5, 5)]);
  const s = run([p], [inc([])]);
  const m = Object.fromEntries(s.urunler[0].varyasyonlar.map((v) => [v.barkod, v]));
  assert.equal(m.B1.elleDegisti, false); assert.equal(m.B2.elleDegisti, true); assert.ok(m.B2.rozetler.includes("ELLE DEĞİŞMİŞ"));
});

test("rezervasyon sayısı gösterilir", () => {
  const s = run([prod([ev("a", "B1", "Krom", 5)])], [inc([])], [], { a: 2 });
  assert.equal(s.urunler[0].varyasyonlar[0].rezerve, 2);
  assert.ok(s.urunler[0].varyasyonlar[0].rozetler.includes("REZERVASYON 2"));
});

test("etiket çözme: ebat 2. parça; tekrar eki atılır", () => {
  assert.deepEqual(etiketCoz("Şeffaf / 7 cm"), { renk: "şeffaf", ebat: "7 cm" });
  assert.deepEqual(etiketCoz("Şeffaf (1234)"), { renk: "şeffaf", ebat: null });
  assert.deepEqual(etiketCoz("Standart"), { renk: "standart", ebat: null });
});

test("barkod değişimi: ebatlı etikette aynı renk+ebat tek çift → öneri", () => {
  const p = prod([ev("a", "OLD", "Krom / 10 cm", 5), ev("b", "B2", "Krom / 15 cm", 5)]);
  const s = run([p], [inc([iv("B2", "Krom / 15 cm"), iv("NEW", "Krom / 10 cm")])]);
  assert.equal(s.urunler[0].varyasyonlar[0].olasiYeniBarkod, "NEW");
  assert.ok(s.urunler[0].varyasyonlar[0].rozetler.includes("BARKOD DEĞİŞMİŞ OLABİLİR"));
});

test("barkod değişimi: ebat farklıysa veya birden fazla aday varsa öneri yok", () => {
  const farkli = run([prod([ev("a", "OLD", "Krom / 10 cm", 5)])], [inc([iv("NEW", "Krom / 15 cm")])]);
  assert.equal(farkli.urunler[0].varyasyonlar[0].olasiYeniBarkod, null);
  const coklu = run([prod([ev("a", "OLD", "Krom / 10 cm", 5)])], [inc([iv("N1", "Krom / 10 cm (1111)"), iv("N2", "Krom / 10 cm (2222)")])]);
  assert.equal(coklu.urunler[0].varyasyonlar[0].olasiYeniBarkod, null);
  const ikiEski = run([prod([ev("a", "O1", "Krom / 10 cm", 5), ev("b", "O2", "Krom / 10 cm (2222)", 5)])], [inc([iv("N1", "Krom / 10 cm")])]);
  assert.ok(ikiEski.urunler[0].varyasyonlar.every((v) => v.olasiYeniBarkod === null));
});

test("barkod değişimi: ebat etikette yoksa ve aynı renkten birden çok varyasyon varsa (Şeffaf 7/10/15) öneri yok", () => {
  const p = prod([ev("a", "O1", "Şeffaf", 5), ev("b", "O2", "Şeffaf (2222)", 5), ev("c", "O3", "Şeffaf (3333)", 5)]);
  const s = run([p], [inc([iv("O2", "Şeffaf"), iv("O3", "Şeffaf (3333)"), iv("N1", "Şeffaf (9999)")])]);
  assert.equal(s.urunler[0].varyasyonlar[0].barkod, "O1");
  assert.equal(s.urunler[0].varyasyonlar[0].olasiYeniBarkod, null);
});

test("barkod değişimi: ebatsız tek renk, tek çift → öneri; stockCode çelişiyorsa yok", () => {
  assert.equal(run([prod([ev("a", "OLD", "Krom", 5)])], [inc([iv("NEW", "Krom")])]).urunler[0].varyasyonlar[0].olasiYeniBarkod, "NEW");
  assert.equal(run([prod([ev("a", "OLD", "Krom", 5, 5, "S1")])], [inc([iv("NEW", "Krom", "S2")])]).urunler[0].varyasyonlar[0].olasiYeniBarkod, null);
});

test("STOCK=SKIP → boş; stoğu 0 olan kalkan listelenmez; yazma/yan etki yok (girdi değişmez)", () => {
  const p = prod([ev("a", "B1", "Krom", 5), ev("b", "B2", "Altın", 0, 0)]);
  const snap = JSON.stringify(p);
  assert.equal(run([p], [inc([])], [], {}, ayar("SKIP")).toplam, 0);
  const s = run([p], [inc([])]);
  assert.equal(s.toplam, 1); assert.equal(s.kalkanToplam, 2);
  assert.equal(JSON.stringify(p), snap);
  // idempotent: aynı girdi aynı çıktı
  assert.deepEqual(run([p], [inc([])]), s);
});

test("kalkan olmayan her şey değişmez: tüm barkodlar gelen listede → boş", () => {
  const p = prod([ev("a", "B1", "Krom", 5)]);
  const s = run([p], [inc([iv("B1", "Krom")])]);
  assert.deepEqual(s, { urunler: [], toplam: 0, kalkanToplam: 0, eslesen: 1, genelUyari: false });
});

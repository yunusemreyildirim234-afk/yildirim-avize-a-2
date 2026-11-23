import test from "node:test";
import assert from "node:assert/strict";
import { aciklamaDonustur, argDogrula, baslikDonustur, kaynakBul, listPriceHesapla, planOlustur, sadelestir } from "../tools/tekli-urun/hesapla.mjs";
import { akis } from "../tools/tekli-urun-olustur.mjs";

const kaynak = (o = {}) => ({
  id: "p1", title: "Modern Avize 4 Adet Gold", description: "4 adet paket.\r\nE14 duylu 4 adet ampul uyumlu.\n4'lü set görünümü, 4 W.", category: "Modern", brand: "Yıldırım",
  imageUrl: "/api/product-images/aaa", images: ["https://x/1.jpg", "/api/product-images/aaa"], listPrice: 500, basePrice: 300, couponAllowed: false,
  pickupDiscountPct: 2, transferDiscountPct: 4, trendyolMainId: "T1", modelCode: "12", ebat: "45 x 25", ...o,
});
const vary = (o = {}) => [{ id: "v1", variationType: "Gövde Rengi", variationValue: "Gold", extraPrice: 5, stock: 6, barcode: "B1", stockCode: "S1", salePrice: 290, listPrice: 500, images: ["https://x/v.jpg"], position: 3, ...o }];

test("sadelestir: Türkçe ve harf duyarsız", () => {
  assert.equal(sadelestir("ÇİÇEK Işık"), "cicek isik");
  assert.equal(kaynakBul([{ id: "a", title: "Kristal AVİZE" }], "avize").durum, "tek");
  assert.equal(kaynakBul([{ id: "a", title: "x" }], "avize").durum, "yok");
  assert.equal(kaynakBul([{ id: "a", title: "avize 1" }, { id: "b", title: "AVİZE 2" }], "avize").durum, "cok");
});

test("başlık dönüşümü: parantezli/parantezsiz/büyük-küçük", () => {
  assert.equal(baslikDonustur("Avize ( 4 Adet )", 4).title, "Avize ( 1 Adet )");
  assert.equal(baslikDonustur("Avize 4 ADET", 4).title, "Avize 1 Adet");
  assert.equal(baslikDonustur("Avize 4adet Gold", 4).title, "Avize 1 Adet Gold");
  assert.equal(baslikDonustur("Avize 14 adet", 4).ok, false);
  assert.equal(baslikDonustur("Avize 6 Adet", 4).ok, false);
});

test("açıklama: adet değişir, belirsizler elle listesine", () => {
  const r = aciklamaDonustur(kaynak().description, 4);
  assert.equal(r.yeni.split("\n")[0], "1 adet paket.");
  assert.equal(r.degisiklikler.length, 1);
  assert.match(r.yeni, /4 adet ampul/); // bileşen sayısı, dokunulmaz
  assert.match(r.yeni, /4'lü/);
  assert.ok(r.elle.some((e) => e.parca.includes("4'lü")));
  assert.ok(r.elle.some((e) => e.parca.includes("4 adet ampul")));
  assert.ok(r.elle.some((e) => e.parca.includes("4 W")));
});

test("fiyat ve stok: 6 x 4 = 24, birim fiyat 99", () => {
  const p = planOlustur({ kaynak: kaynak(), varyasyonlar: vary(), mevcutBasliklar: [], paketAdedi: 4, fiyat: 99 });
  assert.equal(p.varyasyon.stock, 24);
  assert.equal(p.urun.basePrice + p.varyasyon.extraPrice, 99);
  assert.equal(p.urun.title, "Modern Avize 1 Adet Gold");
  assert.equal(p.urun.active, false);
});

test("listPrice bölme", () => {
  assert.equal(listPriceHesapla(500, 4, 99), 125);
  assert.equal(listPriceHesapla(300, 4, 99), null); // 75 <= 99
  assert.equal(listPriceHesapla(null, 4, 99), null);
});

test("doğrulama hataları", () => {
  assert.equal(argDogrula({ kaynak: "a", paketAdedi: "4", fiyat: "99" }).length, 0);
  assert.equal(argDogrula({ kaynak: "a", paketAdedi: "1", fiyat: "99" }).length, 1);
  assert.equal(argDogrula({ kaynak: "a", paketAdedi: "4.5", fiyat: "99" }).length, 1);
  assert.equal(argDogrula({ kaynak: "a", paketAdedi: "4", fiyat: "0" }).length, 1);
  assert.equal(argDogrula({ kaynak: "a", paketAdedi: "4", fiyat: "-5" }).length, 1);
  assert.equal(argDogrula({ kaynak: "", paketAdedi: "4", fiyat: "abc" }).length, 2);
  assert.ok(planOlustur({ kaynak: kaynak(), varyasyonlar: [...vary(), ...vary({ id: "v2" })], mevcutBasliklar: [], paketAdedi: 4, fiyat: 99 }).hata);
  assert.ok(planOlustur({ kaynak: kaynak({ title: "Avize" }), varyasyonlar: vary(), mevcutBasliklar: [], paketAdedi: 4, fiyat: 99 }).hata);
});

test("kopyalanmayacak alanlar boş; kaynaktan gelenler aynen", () => {
  const p = planOlustur({ kaynak: kaynak(), varyasyonlar: vary(), mevcutBasliklar: [], paketAdedi: 4, fiyat: 99 });
  for (const k of ["trendyolMainId", "modelCode", "trendyolCategory", "trendyolUrl", "syncSnapshot", "lastSyncedAt", "bulkMinQty", "bulkDiscountType", "bulkDiscountValue", "bulkTiers", "ebat"]) assert.equal(p.urun[k], null, k);
  for (const k of ["barcode", "stockCode", "salePrice", "listPrice", "syncSnapshot", "syncStock"]) assert.equal(p.varyasyon[k], null, k);
  assert.equal(p.varyasyon.extraPrice, 0);
  assert.equal(p.varyasyon.position, 0);
  assert.deepEqual(p.varyasyon.images, ["https://x/v.jpg"]);
  assert.deepEqual(p.urun.images, kaynak().images);
  assert.notEqual(p.urun.images, kaynak().images);
  assert.equal(p.urun.couponAllowed, false);
  assert.equal(p.urun.pickupDiscountPct, 2);
  assert.equal(p.urun.isFeatured, false);
  assert.ok(p.uyarilar.some((u) => u.includes("ebat")));
  assert.ok(p.uyarilar.some((u) => u.includes("iç görsel")));
});

test("çift ürün engeli", () => {
  const p = planOlustur({ kaynak: kaynak(), varyasyonlar: vary(), mevcutBasliklar: ["MODERN AVİZE 1 adet gold"], paketAdedi: 4, fiyat: 99 });
  assert.match(p.hata, /zaten var/);
});

function sahteDb(yazilan) {
  return {
    urunler: async () => [{ id: "p1", title: "Modern Avize 4 Adet Gold", active: true, stock: 6 }],
    urun: async () => kaynak(),
    varyasyonlar: async () => vary(),
    olustur: async (p) => { yazilan.push(p); return { productId: "n1", variationId: "nv1" }; },
  };
}

test("akış: önizleme yazmaz; EVET dışı yazmaz; EVET yazar", async () => {
  const args = { kaynak: "modern", paketAdedi: "4", fiyat: "99", uygula: false };
  const sessiz = () => {};
  let yazilan = [];
  assert.equal(await akis({ db: sahteDb(yazilan), args, log: sessiz }), "onizleme");
  assert.equal(yazilan.length, 0);
  assert.equal(await akis({ db: sahteDb(yazilan), args: { ...args, uygula: true }, evet: async () => false, log: sessiz }), "iptal");
  assert.equal(yazilan.length, 0);
  assert.equal(await akis({ db: sahteDb(yazilan), args: { ...args, uygula: true }, evet: async () => true, log: sessiz }), "yazildi");
  assert.equal(yazilan.length, 1);
  assert.equal(await akis({ db: sahteDb(yazilan), args: { ...args, kaynak: "yok" }, log: sessiz }), "durdu");
});

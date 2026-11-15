import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { kalkanPlani, kalkanSifirlaSecimi } = await import("../lib/trendyol-kalkan.ts");
const { sifirlaKalkan } = await import("../lib/trendyol-sync.ts");
const { GROUPS } = await import("../lib/trendyol-plan.ts");
console.error = () => {};

const ayar = (stock = "KEEP") => Object.fromEntries(GROUPS.map((g) => [g, g === "STOCK" ? stock : "KEEP"]));
const ev = (id, barcode, value, stock, syncStock = stock) => ({ id, barcode, variationValue: value, extraPrice: 0, stock, stockCode: null, salePrice: 100, listPrice: null, syncStock, syncSnapshot: null });
const iv = (barcode, value) => ({ barcode, variationValue: value, extraPrice: 0, stock: 5, stockCode: null, salePrice: 100, listPrice: null });
const prod = (variations) => ({ id: "p1", trendyolMainId: "M1", title: "Ürün 1", description: null, category: "Kristal", basePrice: 100, listPrice: null, images: [], active: true, brand: null, trendyolCategory: null, trendyolUrl: null, syncSnapshot: null, variations });
const inc = (variations) => ({ mainId: "M1", title: "Ürün 1", description: null, category: "Kristal", basePrice: 100, listPrice: null, images: [], active: true, brand: null, trendyolCategory: null, trendyolUrl: null, variations });

// Krom: kapalı (stok 5 = syncStock 5), Altın: listede yok (stok 2), Bakır: elle değişmiş (stok 9 > syncStock 4), Siyah/Beyaz/Mavi/Yeşil/Gri/Sarı/Mor/Kırmızı/Pembe: Trendyol'da açık
const acik = ["Siyah", "Beyaz", "Mavi", "Yeşil", "Gri", "Sarı", "Mor", "Kırmızı", "Pembe"];
const mevcutV = [ev("a", "B1", "Krom", 5), ev("b", "B2", "Altın", 2), ev("c", "B3", "Bakır", 9, 4), ...acik.map((r, i) => ev(`o${i}`, `O${i}`, r, 3))];
const gelenV = acik.map((r, i) => iv(`O${i}`, r));
const kalkan = () => kalkanPlani([prod(mevcutV)], [inc(gelenV)], new Set(["B1"]), {}, ayar());

test("hiçbir şey işaretlenmediyse seçim boş: hiçbir satır sıfırlanmaz", () => {
  const s = kalkanSifirlaSecimi(kalkan(), []);
  assert.deepEqual(s, { uygulanacak: [], atlanan: [] });
});

test("seçim: kapalı renk uygulanır; elle değişmiş (stock > syncStock) ve listede olmayan kimlik atlanır", () => {
  const s = kalkanSifirlaSecimi(kalkan(), [{ varyasyonId: "a", stok: 5 }, { varyasyonId: "c", stok: 9 }, { varyasyonId: "o0", stok: 3 }, { varyasyonId: "yok", stok: 1 }]);
  assert.deepEqual(s.uygulanacak.map((x) => [x.varyasyonId, x.eskiStok]), [["a", 5]]);
  assert.deepEqual(s.atlanan.map((x) => [x.varyasyonId, x.neden]), [["c", "ELLE_DEGISMIS"], ["o0", "LISTEDE_YOK"], ["yok", "LISTEDE_YOK"]]);
});

test("'listede yok' (ZAYIF) satırı ayrı güvenle gelir ve yalnız açıkça işaretlenirse uygulanır", () => {
  const k = kalkan();
  const v = k.urunler[0].varyasyonlar;
  assert.equal(v.find((x) => x.varyasyonId === "a").guven, "KESIN");
  assert.equal(v.find((x) => x.varyasyonId === "b").guven, "ZAYIF");
  const s = kalkanSifirlaSecimi(k, [{ varyasyonId: "b", stok: 2 }]);
  assert.equal(s.uygulanacak.length, 1);
});

test("önizlemeden beri stoğu değişen satır atlanır; tekrarlanan kimlik bir kez sayılır", () => {
  const s = kalkanSifirlaSecimi(kalkan(), [{ varyasyonId: "a", stok: 4 }, { varyasyonId: "b", stok: 2 }, { varyasyonId: "b", stok: 2 }]);
  assert.deepEqual(s.atlanan, [{ varyasyonId: "a", neden: "STOK_DEGISTI" }]);
  assert.equal(s.uygulanacak.length, 1);
});

test("STOCK 'Dokunma' ise kalkan listesi boş: hiçbir şey sıfırlanamaz", () => {
  const k = kalkanPlani([prod(mevcutV)], [inc(gelenV)], new Set(["B1"]), {}, ayar("SKIP"));
  assert.deepEqual(kalkanSifirlaSecimi(k, [{ varyasyonId: "a", stok: 5 }]).uygulanacak, []);
});

function sahteDb(db) {
  const log = { sorgu: 0, sql: [] };
  globalThis.__fakePrisma = {
    // UPDATE ... WHERE stock = beklenen AND stock > 0 koşulunu taklit eder; yalnız satır silinmeden stock/syncStock yazılır
    $queryRaw: async (strings, ...degerler) => {
      log.sorgu++; log.sql.push(strings.join("?"));
      const cift = degerler.flatMap((d) => (d && d.join ? d.join.flatMap((x) => x.values) : [d]));
      const out = [];
      for (let i = 0; i + 1 < cift.length; i += 2) {
        const row = db.get(cift[i]);
        if (row && row.stock === cift[i + 1] && row.stock > 0) { row.stock = 0; row.syncStock = 0; out.push({ id: row.id }); }
      }
      return out;
    },
  };
  return log;
}

test("sifirlaKalkan: koşullu UPDATE; stok değişmişse yazmaz, silme yok, eski stok listelenir", async () => {
  const db = new Map(mevcutV.map((v) => [v.id, { ...v }]));
  const log = sahteDb(db);
  const r = await sifirlaKalkan(kalkan(), [{ varyasyonId: "a", stok: 5 }, { varyasyonId: "b", stok: 2 }]);
  assert.equal(db.get("a").stock, 0); assert.equal(db.get("a").syncStock, 0);
  assert.equal(db.get("b").stock, 0);
  assert.equal(db.get("c").stock, 9); // dokunulmadı
  assert.equal(db.get("o0").stock, 3);
  assert.equal(db.size, mevcutV.length); // satır silinmedi
  assert.deepEqual(r.sifirlanan.map((x) => [x.varyasyonId, x.eskiStok]), [["a", 5], ["b", 2]]);
  assert.equal(log.sorgu, 1); // tek atomik sorgu
  assert.match(log.sql[0], /"stock" = v\."stock"|v\."stock" = x\.beklenen/);
  // idempotent: ikinci çalıştırmada satır artık listede yok (stok 0): hiçbir şey yazılmaz
  const kalkan2 = kalkanPlani([prod([...db.values()])], [inc(gelenV)], new Set(["B1"]), {}, ayar());
  const r2 = await sifirlaKalkan(kalkan2, [{ varyasyonId: "a", stok: 5 }]);
  assert.equal(r2.sifirlanan.length, 0);
});

test("sifirlaKalkan: arada stok değişirse (yarış) satır atlanır ve raporlanır", async () => {
  const db = new Map(mevcutV.map((v) => [v.id, { ...v }]));
  sahteDb(db);
  const k = kalkan();
  db.get("a").stock = 4; // önizleme ile uygulama arasında satış
  const r = await sifirlaKalkan(k, [{ varyasyonId: "a", stok: 5 }]);
  assert.equal(db.get("a").stock, 4);
  assert.deepEqual(r.atlanan, [{ varyasyonId: "a", neden: "STOK_DEGISTI" }]);
});

test("boş seçimde veritabanına hiç sorgu atılmaz", async () => {
  const log = sahteDb(new Map());
  const r = await sifirlaKalkan(kalkan(), []);
  assert.equal(log.sorgu, 0);
  assert.equal(r.sifirlanan.length, 0);
});

test("geri dönüş: syncStock=0 olan renk Trendyol'a T=5 ile dönerse KEEP formülü stoğu 5 yapar", () => {
  const stock = 0, syncStock = 0, t = 5;
  assert.equal(Math.max(0, t + (stock - (syncStock ?? t))), 5);
});

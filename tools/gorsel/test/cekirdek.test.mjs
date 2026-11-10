import test from "node:test";
import assert from "node:assert/strict";
import {
  argumanlar, bekleyenler, blobYolu, bosManifest, geriAlPlani, GUVENLI_SINIR, kotaDurumu, manifesteYaz, partilerleUygula, sec, sirala, urunKaynaklari, yazmaSay, yazPlani, yedekIcerigi,
} from "../lib/cekirdek.mjs";
import { sahteDb, T } from "./sahte.mjs";

const B = (pid, ad) => `https://sahte.public.blob.vercel-storage.com/urun/${pid}/${ad}-kr-b.webp`;
const urun = (id, modelCode, images, ek = {}) => ({ id, modelCode, title: `Ürün ${id}`, images, imageUrl: images[0] ?? null, imageMap: {}, variations: [], ...ek });

/** Ürünün tüm kaynaklarını manifestte "yüklenmiş" yapar. */
function hazirla(m, u, tuval = "kare") {
  for (const url of urunKaynaklari(u)) manifesteYaz(m, u.id, url, tuval, { b: B(u.id, url.split("/").pop().replace(".jpg", "")), k: "k" });
}

test("argumanlar: varsayılanlar, bayraklar ve hatalar", () => {
  assert.deepEqual(argumanlar([]), { ornek: null, urun: null, dryRun: false, tuval: "kare", siniriAs: false });
  assert.deepEqual(argumanlar(["--ornek", "10", "--dry-run", "--tuval", "oran", "--urun", "5, 17", "--siniri-as"]), { ornek: 10, urun: ["5", "17"], dryRun: true, tuval: "oran", siniriAs: true });
  for (const kotu of [["--ornek"], ["--ornek", "0"], ["--ornek", "x"], ["--tuval", "yuvarlak"], ["--evet"], ["--urun", "--dry-run"]]) assert.throws(() => argumanlar(kotu));
});

test("blobYolu belirlenimci; tuval ve boyut yolu ayırır", () => {
  assert.equal(blobYolu("p1", T("a"), "kare", "b"), blobYolu("p1", T("a"), "kare", "b"));
  assert.match(blobYolu("p1", T("a"), "kare", "b"), /^urun\/p1\/[0-9a-f]{16}-kr-v2-b.webp$/);
  assert.match(blobYolu("p1", T("a"), "oran", "k"), /-or-v2-k.webp$/);
  assert.notEqual(blobYolu("p1", T("a"), "kare", "b"), blobYolu("p1", T("b"), "kare", "b"));
});

test("urunKaynaklari: genel + kapak + renk görsellerindeki tekil Trendyol adresleri; Blob ve yüklenmiş görsel sayılmaz", () => {
  const u = urun("p1", "1", [T("a"), B("p1", "x"), "/api/product-images/11111111-1111-1111-1111-111111111111"], { imageUrl: T("kapak"), variations: [{ id: "v1", images: [T("a"), T("renk")] }] });
  assert.deepEqual(urunKaynaklari(u), [T("a"), T("kapak"), T("renk")]);
});

test("sirala/sec: model koduna göre sayısal sıra; --ornek ilk N uygun ürün; bilinmeyen model kodu hata", () => {
  const liste = [urun("c", "10", [T("c")]), urun("a", "2", [T("a")]), urun("z", null, [T("z")]), urun("b", "1", [])];
  assert.deepEqual(sirala(liste).map((u) => u.id), ["b", "a", "c", "z"]);
  const uygun = (u) => urunKaynaklari(u).length > 0;
  assert.deepEqual(sec(liste, { ornek: 2, urun: null }, uygun).map((u) => u.id), ["a", "c"]);
  assert.deepEqual(sec(liste, { ornek: null, urun: ["10"] }, uygun).map((u) => u.id), ["c"]);
  assert.throws(() => sec(liste, { ornek: null, urun: ["999"] }, uygun), /999/);
});

test("kota: yazma denemeleri aylık sayılır; 1800 aşılırsa asar", () => {
  const m = bosManifest();
  const ay = "2026-11";
  assert.deepEqual(kotaDurumu(m, 1254, ay), { ay, kullanilan: 0, planlanan: 1254, kalan: 2000, sonraKalan: 746, asar: false });
  for (let i = 0; i < 600; i++) yazmaSay(m, ay);
  assert.equal(kotaDurumu(m, GUVENLI_SINIR - 600, ay).asar, false);
  const k = kotaDurumu(m, 1254, ay);
  assert.equal(k.asar, true);
  assert.equal(k.kalan, 1400);
  assert.equal(kotaDurumu(m, 1254, "2026-12").asar, false); // yeni ay: sayaç sıfır
});

test("bekleyenler: yalnızca bu tuval için manifestte olmayanlar (devam edilebilir)", () => {
  const m = bosManifest();
  const u = urun("p1", "1", [T("a"), T("b")]);
  assert.equal(bekleyenler([u], m, "kare").length, 2);
  manifesteYaz(m, "p1", T("a"), "kare", { b: B("p1", "a"), k: "k" });
  assert.deepEqual(bekleyenler([u], m, "kare"), [{ productId: "p1", url: T("b") }]);
  assert.equal(bekleyenler([u], m, "oran").length, 2);
});

test("yazPlani: tüm kaynaklar hazırsa plan; biri eksikse ürün HİÇ yazılmaz", () => {
  const m = bosManifest();
  const u = urun("p1", "1", [T("a"), T("b")], { variations: [{ id: "v1", images: [T("r")] }, { id: "v2", images: [] }] });
  manifesteYaz(m, "p1", T("a"), "kare", { b: B("p1", "a"), k: "k" });
  assert.deepEqual(yazPlani(u, m, "kare"), { plan: null, eksik: 2 });
  hazirla(m, u);
  const { plan, eksik } = yazPlani(u, m, "kare");
  assert.equal(eksik, 0);
  assert.deepEqual(plan.yeni, { images: [B("p1", "a"), B("p1", "b")], imageUrl: B("p1", "a") });
  assert.deepEqual(plan.eski, { images: [T("a"), T("b")], imageUrl: T("a") });
  assert.deepEqual(plan.varyasyonlar, [{ id: "v1", eski: [T("r")], yeni: [B("p1", "r")] }]);
  assert.deepEqual(plan.imageMapEk, { [T("a")]: B("p1", "a"), [T("b")]: B("p1", "b"), [T("r")]: B("p1", "r") });
  assert.deepEqual(yazPlani(u, m, "oran"), { plan: null, eksik: 3 }); // başka tuval yüklenmemiş
});

test("yazPlani: Trendyol görseli olmayan (ya da zaten taşınmış) üründe plan yok", () => {
  const m = bosManifest();
  assert.deepEqual(yazPlani(urun("p1", "1", [B("p1", "a"), "/api/product-images/x"]), m, "kare"), { plan: null, eksik: 0 });
});

test("yaz → geri-al: partili, koşullu; geri alma eski değerleri AYNEN döndürür, imageMap kalır", async () => {
  const m = bosManifest();
  const urunler = Array.from({ length: 45 }, (_, i) => urun(`p${i}`, String(i + 1), [T(`a${i}`), T(`b${i}`)], { variations: [{ id: `v${i}`, images: [T(`r${i}`)] }] }));
  urunler.push(urun("elle", "99", ["/api/product-images/x"]));
  for (const u of urunler) hazirla(m, u);
  const db = sahteDb(urunler);
  const ilk = structuredClone(await db.urunleriOku());

  const planlar = (await db.urunleriOku()).map((u) => yazPlani(u, m, "kare").plan).filter(Boolean);
  assert.equal(planlar.length, 45);
  const loglar = [];
  const ozet = await partilerleUygula(db, planlar, { log: (s) => loglar.push(s) });
  assert.deepEqual({ yazilan: ozet.yazilan, atlanan: ozet.atlanan, parti: ozet.parti }, { yazilan: 45, atlanan: [], parti: 3 }); // 20 + 20 + 5
  assert.equal(db.partiSayisi(), 3);
  const sonra = await db.urunleriOku();
  assert.equal(sonra.filter((u) => u.images.some((x) => x.includes("dsmcdn"))).length, 0); // artık hiçbir ürün Trendyol adresi tutmuyor
  assert.deepEqual(sonra.find((u) => u.id === "elle").images, ["/api/product-images/x"]);
  assert.equal(sonra.find((u) => u.id === "p3").imageMap[T("a3")], B("p3", "a3"));

  // İdempotent: ikinci kez yazılacak bir şey yok
  assert.equal(sonra.map((u) => yazPlani(u, m, "kare").plan).filter(Boolean).length, 0);

  const geri = sonra.map(geriAlPlani).filter(Boolean);
  assert.equal(geri.length, 45);
  await partilerleUygula(db, geri);
  const son = await db.urunleriOku();
  for (const u of son) {
    const o = ilk.find((x) => x.id === u.id);
    assert.deepEqual({ images: u.images, imageUrl: u.imageUrl, variations: u.variations }, { images: o.images, imageUrl: o.imageUrl, variations: o.variations });
  }
  assert.equal(son.find((u) => u.id === "p3").imageMap[T("a3")], B("p3", "a3")); // imageMap silinmez
  assert.equal(son.map(geriAlPlani).filter(Boolean).length, 0);
  // Yeniden ileri: yükleme gerekmeden aynı plan
  assert.equal(son.map((u) => yazPlani(u, m, "kare").plan).filter(Boolean).length, 45);
});

test("koşullu yazma: okunduktan sonra değişen ürün ATLANIR, diğerleri yazılır", async () => {
  const m = bosManifest();
  const urunler = [urun("p1", "1", [T("a")]), urun("p2", "2", [T("b")])];
  for (const u of urunler) hazirla(m, u);
  const db = sahteDb(urunler, { oncePartiden: (veri) => veri.get("p2").images.push("/api/product-images/yeni") }); // admin araya girdi
  const planlar = (await db.urunleriOku()).map((u) => yazPlani(u, m, "kare").plan);
  const ozet = await partilerleUygula(db, planlar);
  assert.equal(ozet.yazilan, 1);
  assert.deepEqual(ozet.atlanan, ["p2"]);
  assert.deepEqual(db.veri.get("p2").images, [T("b"), "/api/product-images/yeni"]);
  assert.deepEqual(db.veri.get("p1").images, [B("p1", "a")]);
});

test("doğrulama: geri okunan değer beklenenle uyuşmazsa ya da dogrula() hata verirse DURUR, sonraki parti yazılmaz", async () => {
  const m = bosManifest();
  const urunler = Array.from({ length: 5 }, (_, i) => urun(`p${i}`, String(i + 1), [T(`a${i}`)]));
  for (const u of urunler) hazirla(m, u);

  const db1 = sahteDb(urunler);
  const planlar = (await db1.urunleriOku()).map((u) => yazPlani(u, m, "kare").plan);
  await assert.rejects(partilerleUygula(db1, planlar, { parti: 2, dogrula: async () => { throw new Error("görsel açılmıyor"); } }), /görsel açılmıyor/);
  assert.equal(db1.partiSayisi(), 1);
  assert.deepEqual(db1.veri.get("p4").images, [T("a4")]);

  const db2 = sahteDb(urunler);
  const bozuk = { ...db2, urunleriOku: async (ids) => (await db2.urunleriOku(ids)).map((u) => ({ ...u, images: [] })) };
  await assert.rejects(partilerleUygula(bozuk, planlar, { parti: 2 }), /Doğrulama başarısız/);
  assert.equal(db2.partiSayisi(), 1);
});

test("yedekIcerigi: yazmadan önceki ürün ve renk değerleri", () => {
  const m = bosManifest();
  const u = urun("p1", "7", [T("a")], { variations: [{ id: "v1", images: [T("r")] }] });
  hazirla(m, u);
  const y = yedekIcerigi([yazPlani(u, m, "kare").plan], { islem: "yaz" });
  assert.deepEqual(y, { islem: "yaz", urunler: [{ id: "p1", modelCode: "7", images: [T("a")], imageUrl: T("a"), varyasyonlar: [{ id: "v1", images: [T("r")] }] }] });
});

test("v2: v1 manifest kayıtları görmezden gelinir ama silinmez; v1 taşınmış ürün imageMap ile v2'ye yeniden taşınır, geri-al Trendyol'a döner", () => {
  const V1 = (ad) => `https://sahte.public.blob.vercel-storage.com/urun/p1/${ad}-kr-b.webp`;
  const V2 = (ad) => `https://sahte.public.blob.vercel-storage.com/urun/p1/${ad}-kr-v2-b.webp`;
  const m = bosManifest();
  m.gorseller.p1 = { [T("a")]: { kare: { b: V1("a"), k: "k" } } }; // eski v1 kaydı
  // ürün şu an v1 Blob adresini tutuyor; eski Trendyol adresi imageMap'te
  const u = urun("p1", "1", [V1("a")], { imageMap: { [T("a")]: V1("a") }, variations: [{ id: "v1", images: [V1("a")] }] });
  assert.deepEqual(urunKaynaklari(u), [T("a")]);
  assert.deepEqual(bekleyenler([u], m, "kare"), [{ productId: "p1", url: T("a") }]); // v2 için hâlâ yüklenmemiş
  assert.deepEqual(yazPlani(u, m, "kare"), { plan: null, eksik: 1 });
  manifesteYaz(m, "p1", T("a"), "kare", { b: V2("a"), k: "k" });
  assert.deepEqual(m.gorseller.p1[T("a")].kare, { b: V1("a"), k: "k" }); // v1 kaydı duruyor
  const { plan } = yazPlani(u, m, "kare");
  assert.deepEqual(plan.yeni, { images: [V2("a")], imageUrl: V2("a") });
  assert.deepEqual(plan.varyasyonlar, [{ id: "v1", eski: [V1("a")], yeni: [V2("a")] }]);
  assert.deepEqual(plan.imageMapEk, { [T("a")]: V2("a") });
  // v2 yazıldıktan sonra tekrar plan yok; geri-al Trendyol'a döner
  const yazildi = urun("p1", "1", [V2("a")], { imageMap: { [T("a")]: V2("a") }, variations: [{ id: "v1", images: [V2("a")] }] });
  assert.equal(yazPlani(yazildi, m, "kare").plan, null);
  assert.deepEqual(geriAlPlani(yazildi).yeni, { images: [T("a")], imageUrl: T("a") });
});

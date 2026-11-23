import test from "node:test";
import assert from "node:assert/strict";
import { csvAyristir, satirDogrula } from "../tools/tekli-urun/liste.mjs";
import { argDogrula, kaynakIdBul } from "../tools/tekli-urun/hesapla.mjs";
import { akis, argumanlar } from "../tools/tekli-urun-olustur.mjs";

const sessiz = () => {};

test("CSV: ; ve , ayracı, BOM, ondalık, boş satır, fazla sütun yok sayılır", () => {
  const a = csvAyristir("﻿urun_id;paket_adedi;fiyat;not\r\np1;4;37,5;x\r\n\r\np2;2;99.9;y\r\n;;;\r\n");
  assert.deepEqual(a.satirlar.map((s) => [s.satir, s.urun_id, s.paket_adedi, s.fiyat]), [[2, "p1", "4", "37,5"], [4, "p2", "2", "99.9"]]);
  const b = csvAyristir("Ürün_ID,Paket_Adedi,Fiyat\np1,4,37.5\n");
  assert.equal(b.satirlar.length, 1);
  assert.equal(b.satirlar[0].fiyat, "37.5");
  const c = csvAyristir('fiyat,urun_id,paket_adedi\n"37,5",p1,4\n');
  assert.equal(c.satirlar[0].fiyat, "37,5");
  assert.equal(c.satirlar[0].urun_id, "p1");
});

test("CSV: eksik sütun, boş liste, 100+ satır", () => {
  assert.match(csvAyristir("urun_id;fiyat\np1;3").hata, /paket_adedi/);
  assert.ok(csvAyristir("").hata);
  assert.ok(csvAyristir("urun_id;paket_adedi;fiyat\n").hata);
  const satir = (n) => Array.from({ length: n }, (_, i) => `p${i};4;10`).join("\n");
  assert.equal(csvAyristir(`urun_id;paket_adedi;fiyat\n${satir(100)}`).satirlar.length, 100);
  assert.match(csvAyristir(`urun_id;paket_adedi;fiyat\n${satir(101)}`).hata, /101/);
  const eksikHucre = csvAyristir("urun_id;paket_adedi;fiyat\np1;4\n");
  assert.equal(eksikHucre.satirlar[0].fiyat, "");
  assert.ok(satirDogrula(eksikHucre.satirlar[0]).hata);
});

test("satır doğrulama", () => {
  assert.deepEqual(satirDogrula({ urun_id: " p1 ", paket_adedi: "4", fiyat: "37,5" }), { id: "p1", n: 4, fiyat: 37.5 });
  for (const s of [{ urun_id: "", paket_adedi: "4", fiyat: "9" }, { urun_id: "p", paket_adedi: "1", fiyat: "9" }, { urun_id: "p", paket_adedi: "4", fiyat: "0" }, { urun_id: "p", paket_adedi: "4", fiyat: "abc" }]) assert.ok(satirDogrula(s).hata);
});

test("--kaynak-id: argüman, doğrulama, seçim", () => {
  const a = argumanlar(["--kaynak-id", "p1", "--paket-adedi", "4", "--fiyat", "9", "--liste", "x.csv", "--ayrinti"]);
  assert.equal(a.kaynakId, "p1");
  assert.equal(a.liste, "x.csv");
  assert.equal(a.ayrinti, true);
  assert.equal(argDogrula({ kaynakId: "p1", paketAdedi: "4", fiyat: "9" }).length, 0);
  assert.equal(argDogrula({ kaynak: "a", kaynakId: "p1", paketAdedi: "4", fiyat: "9" }).length, 1);
  assert.equal(argDogrula({ paketAdedi: "4", fiyat: "9" }).length, 1);
  const u = [{ id: "a", title: "x", active: true }, { id: "b", title: "y", active: false }];
  assert.equal(kaynakIdBul(u, "a").durum, "tek");
  assert.equal(kaynakIdBul(u, "b").durum, "pasif");
  assert.equal(kaynakIdBul(u, "z").durum, "yok");
});

// ---- akış (sahte db) ----
const urunSatiri = (id, title, o = {}) => ({
  id, title, description: "4 adet paket.", category: "Modern", brand: "Y", imageUrl: null, images: [], listPrice: null, basePrice: 300, couponAllowed: true,
  pickupDiscountPct: null, transferDiscountPct: null, ebat: null, videoUrl: null, ...o,
});
const varSatiri = (o = {}) => [{ id: "v", variationType: "Renk", variationValue: "Gold", extraPrice: 0, stock: 6, images: [], position: 0, ...o }];

function sahteDb(yazilan, { varsayilanVar = varSatiri() } = {}) {
  const urunler = {
    p1: urunSatiri("p1", "Avize A 4 Adet"),
    p2: urunSatiri("p2", "Avize B 4 Adet"),
    p3: urunSatiri("p3", "Avize C 4 Adet"),
    pp: urunSatiri("pp", "Pasif 4 Adet"),
    pc: urunSatiri("pc", "Çok Varyasyon 4 Adet"),
    pn: urunSatiri("pn", "Adetsiz Avize"),
  };
  const liste = [
    ...["p1", "p2", "p3", "pc", "pn"].map((id) => ({ id, title: urunler[id].title, active: true, stock: 6 })),
    { id: "pp", title: urunler.pp.title, active: false, stock: 6 },
    { id: "px", title: "Avize C 1 Adet", active: true, stock: 1 }, // p3'ün yeni başlığı zaten var
  ];
  return {
    urunler: async () => liste,
    urun: async (id) => urunler[id],
    varyasyonlar: async (id) => (id === "pc" ? [...varsayilanVar, ...varSatiri({ id: "v2" })] : varsayilanVar),
    olustur: async () => assert.fail("toplu modda tekli olustur çağrılmamalı"),
    olusturToplu: async (planlar) => { yazilan.push(planlar); return planlar.map((_, i) => ({ productId: `n${i}`, variationId: `nv${i}` })); },
  };
}
const csv = (...s) => `urun_id;paket_adedi;fiyat\n${s.join("\n")}\n`;
const run = (db, args, metin, ek = {}) => {
  const out = [];
  return akis({ db, args: { liste: "l.csv", uygula: false, ...args }, oku: () => metin, log: (m) => out.push(m), evet: async () => true, ...ek }).then((r) => ({ r, out: out.join("\n") }));
};

test("liste önizleme: OK/ATLANDI/HATA satırları ve özet, yazmaz", async () => {
  const y = [];
  const { r, out } = await run(sahteDb(y), {}, csv("p1;4;99", "p3;4;99", "pp;4;9", "yok;4;9", "pc;4;9", "pn;4;9", "p2;1;9", "p2;4;abc"));
  assert.equal(r, "onizleme");
  assert.equal(y.length, 0);
  assert.match(out, /satır 2 \| OK \| Avize A 4 Adet → Avize A 1 Adet \| 99 TL \| stok 24/);
  assert.match(out, /satır 3 \| ATLANDI/);
  assert.match(out, /satır 4 \| HATA \| kaynak pasif/);
  assert.match(out, /satır 5 \| HATA \| kaynak bulunamadı/);
  assert.match(out, /satır 6 \| HATA \| .*2 varyasyonu/);
  assert.match(out, /satır 7 \| HATA \| .*adet" ifadesi bulunamadı/);
  assert.match(out, /satır 8 \| HATA \| paket_adedi/);
  assert.match(out, /satır 9 \| HATA \| fiyat/);
  assert.match(out, /1 OK, 1 ATLANDI, 6 HATA/);
  assert.doesNotMatch(out, /önce :/); // ayrıntı yok
});

test("--ayrinti açıklama önce/sonra yazar", async () => {
  const { out } = await run(sahteDb([]), { ayrinti: true }, csv("p1;4;99"));
  assert.match(out, /önce : 4 adet paket\./);
});

test("aynı yeni başlık listede iki kez → ikincisi HATA", async () => {
  const db = sahteDb([]);
  const { out } = await run(db, {}, csv("p1;4;99", "p1;4;99"));
  assert.match(out, /satır 2 \| OK/);
  assert.match(out, /satır 3 \| HATA \| aynı yeni başlık listede iki kez/);
});

test("HATA varken --uygula hiçbir şey yazmaz ve EVET sormaz", async () => {
  const y = [];
  let soruldu = false;
  const { r } = await run(sahteDb(y), { uygula: true }, csv("p1;4;99", "yok;4;9"), { evet: async () => { soruldu = true; return true; } });
  assert.equal(r, "durdu");
  assert.equal(y.length, 0);
  assert.equal(soruldu, false);
});

test("EVET yoksa yazmaz; EVET ile TEK toplu çağrıda hepsi yazılır, id'ler listelenir", async () => {
  const y = [];
  const metin = csv("p1;4;99", "p2;4;37,5", "p3;4;99");
  assert.equal((await run(sahteDb(y), { uygula: true }, metin, { evet: async () => false })).r, "iptal");
  assert.equal(y.length, 0);
  const { r, out } = await run(sahteDb(y), { uygula: true }, metin);
  assert.equal(r, "yazildi"); // p3 ATLANDI, 2 OK
  assert.equal(y.length, 1);
  assert.equal(y[0].length, 2);
  assert.equal(y[0][1].urun.basePrice, 37.5);
  assert.equal(y[0][0].urun.active, false);
  assert.equal(y[0][0].urun.modelCode, null);
  assert.match(out, /Avize A 1 Adet → n0/);
  assert.match(out, /Avize B 1 Adet → n1/);
});

test("yalnız ATLANDI varsa yazılacak şey yok; tekrar çalıştırma güvenli", async () => {
  const y = [];
  const { r } = await run(sahteDb(y), { uygula: true }, csv("p3;4;99"));
  assert.equal(r, "bos");
  assert.equal(y.length, 0);
});

test("liste dosyası/başlık hataları ve karışık seçenekler durdurur", async () => {
  assert.equal((await run(sahteDb([]), {}, "urun_id;fiyat\np1;3")).r, "durdu");
  assert.equal((await run(sahteDb([]), { kaynak: "a" }, csv("p1;4;99"))).r, "durdu");
  const out = [];
  assert.equal(await akis({ db: sahteDb([]), args: { liste: "yok.csv" }, oku: () => { throw new Error("ENOENT"); }, log: (m) => out.push(m) }), "durdu");
});

test("tek ürün modu bozulmadı: --kaynak ve --kaynak-id", async () => {
  const y = [];
  const db = sahteDb(y);
  db.olustur = async (p) => { y.push(p); return { productId: "n1", variationId: "nv1" }; };
  const args = { paketAdedi: "4", fiyat: "99", uygula: true };
  assert.equal(await akis({ db, args: { ...args, kaynak: "avize a" }, evet: async () => true, log: sessiz }), "yazildi");
  assert.equal(await akis({ db, args: { ...args, kaynakId: "p1" }, evet: async () => true, log: sessiz }), "yazildi");
  assert.equal(y.length, 2);
  assert.equal(await akis({ db, args: { ...args, kaynakId: "pp" }, evet: async () => true, log: sessiz }), "durdu");
  assert.equal(await akis({ db, args: { ...args, kaynakId: "yok" }, evet: async () => true, log: sessiz }), "durdu");
  assert.equal(y.length, 2);
});

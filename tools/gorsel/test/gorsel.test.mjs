import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { isle } from "../lib/gorsel.mjs";
import { kopyala } from "../lib/kopya.mjs";
import { blobYolu, bosManifest, kotaDurumu, manifestKaydi } from "../lib/cekirdek.mjs";
import { onizlemeHtml } from "../lib/onizleme-html.mjs";
import { sahteBlob, T } from "./sahte.mjs";

/** Sentetik görsel: düz zemin üzerinde dikdörtgen(ler). Ağ yok. */
async function resim(w, h, zemin, kutular = []) {
  const composite = await Promise.all(kutular.map(async ([left, top, kw, kh, renk]) => ({ input: await sharp({ create: { width: kw, height: kh, channels: 3, background: renk } }).png().toBuffer(), left, top })));
  return sharp({ create: { width: w, height: h, channels: 3, background: zemin } }).composite(composite).jpeg({ quality: 92 }).toBuffer();
}
const meta = (buf) => sharp(buf).metadata();
/** Çıktıda (x, y) pikselinin rengi. */
async function piksel(buf, x, y) {
  const { data } = await sharp(buf).extract({ left: x, top: y, width: 1, height: 1 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return [...data];
}

test("beyaz zeminli dikey ürün: kırpılır, ürün KESİLMEZ; kare tuval kare, oran tuval oranı korur", async () => {
  // 1200x1800 beyaz zemin, ortada 400x900 koyu ürün (x 400..800, y 450..1350)
  const girdi = await resim(1200, 1800, "#ffffff", [[400, 450, 400, 900, "#3a2a1a"]]);
  const s = await isle(girdi, ["kare", "oran"]);
  assert.equal(s.beyazZemin, true);
  assert.equal(s.durum, "kirpildi");
  // Korunan kutu ürünü tümüyle içerir ve pay bırakır
  assert.ok(s.kutu.left <= 400 - 30 && s.kutu.top <= 450 - 30, JSON.stringify(s.kutu));
  assert.ok(s.kutu.left + s.kutu.width >= 800 + 30 && s.kutu.top + s.kutu.height >= 1350 + 30, JSON.stringify(s.kutu));
  assert.ok(s.kutu.width < 1200 && s.kutu.height < 1800);

  const kare = await meta(s.ciktilar.kare.b);
  assert.equal(kare.format, "webp");
  assert.equal(kare.width, kare.height);
  const oran = await meta(s.ciktilar.oran.b);
  assert.ok(Math.abs(oran.width / oran.height - s.kutu.width / s.kutu.height) < 0.01);
  // Kare tuvalin köşesi beyaz, ortası ürün rengi
  const [r] = await piksel(s.ciktilar.kare.b, 2, 2);
  assert.ok(r > 245);
  const [mr] = await piksel(s.ciktilar.kare.b, Math.floor(kare.width / 2), Math.floor(kare.height / 2));
  assert.ok(mr < 90);
  // Küçük sürüm en çok 800 px
  const k = await meta(s.ciktilar.kare.k);
  assert.ok(Math.max(k.width, k.height) <= 800);
});

test("soluk (kristal benzeri) kenar: pay sayesinde orijinal piksel olarak korunur", async () => {
  // Koyu gövdenin iki yanında beyazdan neredeyse ayırt edilemeyen (#fcfcfc) 20 px'lik 'kristal' şeritler: eşik bunları ürün saymaz, pay geri getirir
  const girdi = await resim(1000, 1000, "#ffffff", [[380, 300, 20, 400, "#fcfcfc"], [600, 300, 20, 400, "#fcfcfc"], [400, 300, 200, 400, "#202020"]]);
  const s = await isle(girdi, ["oran"]);
  assert.equal(s.durum, "kirpildi");
  assert.ok(s.kutu.left <= 380 && s.kutu.left + s.kutu.width >= 620, JSON.stringify(s.kutu));
});

test("belirgin soluk kenar (#f4f4f4) doğrudan ürün sayılır; kırık beyaz zeminde tuval zemin renginde olur (dikiş izi yok)", async () => {
  const soluk = await isle(await resim(1000, 1000, "#ffffff", [[300, 300, 100, 400, "#f4f4f4"], [400, 300, 200, 400, "#202020"]]), ["oran"]);
  assert.ok(soluk.kutu.left <= 300 - 20, JSON.stringify(soluk.kutu));
  const kirik = await isle(await resim(900, 1500, "#f8f8f8", [[300, 400, 300, 700, "#202020"]]), ["kare"]);
  assert.equal(kirik.durum, "kirpildi");
  const m = await meta(kirik.ciktilar.kare.b);
  assert.equal(m.width, m.height);
  const [r] = await piksel(kirik.ciktilar.kare.b, 2, Math.floor(m.height / 2)); // eklenen tuval şeridi
  assert.ok(r >= 246 && r <= 250, String(r));
});

test("ortam fotoğrafı (zemin beyaz değil): kırpılmaz, tuval eklenmez, iki modda aynı oran", async () => {
  const girdi = await resim(1200, 1800, "#8a7a6a", [[300, 300, 500, 900, "#f0e0c0"]]);
  const s = await isle(girdi, ["kare", "oran"]);
  assert.equal(s.beyazZemin, false);
  assert.equal(s.durum, "zemin-beyaz-degil");
  assert.deepEqual(s.kutu, { left: 0, top: 0, width: 1200, height: 1800 });
  for (const t of ["kare", "oran"]) {
    const m = await meta(s.ciktilar[t].b);
    assert.deepEqual([m.width, m.height], [1067, 1600]);
  }
});

test("aşırı kırpma güvenliği: ürün çok küçük kalacaksa kırpılmaz ve işaretlenir", async () => {
  const girdi = await resim(1200, 1200, "#ffffff", [[550, 550, 100, 100, "#101010"]]);
  const s = await isle(girdi, ["kare"]);
  assert.equal(s.durum, "asiri-kirpma");
  assert.deepEqual(s.kutu, { left: 0, top: 0, width: 1200, height: 1200 });
});

test("tümüyle beyaz ya da kenarsız görsel hata vermez; küçük görsel büyütülmez", async () => {
  const bos = await isle(await resim(600, 400, "#ffffff"), ["kare"]);
  assert.ok(["kenar-yok", "asiri-kirpma"].includes(bos.durum), bos.durum);
  const dolu = await isle(await resim(500, 500, "#ffffff", [[0, 250, 500, 250, "#222222"], [0, 0, 20, 20, "#ffffff"]]), ["oran"]);
  const m = await meta(dolu.ciktilar.oran.b);
  assert.ok(m.width <= 500 && m.height <= 500);
});

test("kopyala (sahte Blob): iki sürüm yazar, manifest ve kota sayacı güncellenir; yeniden çalıştırma hiçbir şey yazmaz", async () => {
  const girdi = await resim(900, 1200, "#ffffff", [[300, 300, 300, 600, "#443322"]]);
  const blob = sahteBlob();
  const manifest = bosManifest();
  let kayit = 0;
  const ortak = { manifest, tuval: "kare", blob, indir: async () => girdi, isle, kaydet: () => kayit++ };
  const is = [{ productId: "p1", url: T("a") }, { productId: "p1", url: T("b") }, { productId: "p2", url: T("c") }];
  const r = await kopyala({ ...ortak, is });
  assert.deepEqual(r, { tamam: 3, hatalar: [] });
  assert.equal(blob.putSayisi(), 6);
  assert.equal(kotaDurumu(manifest, 0).kullanilan, 6);
  assert.ok(kayit >= 9);
  const k = manifestKaydi(manifest, "p1", T("a"), "kare");
  assert.equal(k.b, `https://sahte.public.blob.vercel-storage.com/${blobYolu("p1", T("a"), "kare", "b")}`);
  assert.match(k.k, /-kr-k\.webp$/);
  assert.equal(blob.dosyalar.get(blobYolu("p1", T("a"), "kare", "b")).length, k.baytB);

  const r2 = await kopyala({ ...ortak, is });
  assert.deepEqual(r2, { tamam: 0, hatalar: [] });
  assert.equal(blob.putSayisi(), 6);
});

test("kopyala: hata olan görsel atlanır ve raporlanır; sonraki koşu kaldığı yerden sürer; manifestsiz kalmış dosya head ile bulunur", async () => {
  const girdi = await resim(600, 600, "#ffffff", [[200, 200, 200, 200, "#443322"]]);
  const manifest = bosManifest();
  const is = [{ productId: "p1", url: T("a") }, { productId: "p1", url: T("b") }];
  // T("b") indirilemiyor; T("a")'nın küçük sürümünde ilk put ağ hatası veriyor (büyük sürüm yüklenmiş kalır)
  const blob = sahteBlob({ putHatasi: (yol, n) => n === 2 });
  const indir = async (url) => {
    if (url === T("b")) throw new Error("indirilemedi: HTTP 404");
    return girdi;
  };
  const ortak = { manifest, tuval: "kare", blob, isle, kaydet: () => {}, es: 1 };
  const r = await kopyala({ ...ortak, is, indir });
  assert.equal(r.tamam, 0);
  assert.equal(r.hatalar.length, 2);
  assert.equal(manifestKaydi(manifest, "p1", T("a"), "kare"), null);
  assert.equal(kotaDurumu(manifest, 0).kullanilan, 2); // başarısız deneme de sayılır

  // İkinci koşu: büyük sürüm zaten var (put "already exists" → head), küçük sürüm yüklenir
  const r2 = await kopyala({ ...ortak, is, indir: async () => girdi });
  assert.deepEqual(r2, { tamam: 2, hatalar: [] });
  assert.ok(manifestKaydi(manifest, "p1", T("a"), "kare").b.endsWith("-kr-b.webp"));
  assert.equal(blob.dosyalar.size, 4);
});

test("onizlemeHtml: iki varyant yan yana, kırpma kutusu yüzdeyle, metin kaçışlı", () => {
  const v = { dosya: "onizleme/x.webp", w: 800, h: 800, baytB: 90000, baytK: 30000 };
  const html = onizlemeHtml([{ modelCode: "7", title: "Kristal <Avize> & Co", gorseller: [
    { url: T("a"), orijinal: "onizleme/o.webp", orijinalBayt: 200000, kaynak: { w: 1200, h: 1800 }, kutu: { left: 300, top: 450, width: 600, height: 900 }, durum: "kirpildi", kare: v, oran: v },
    { url: T("b"), hata: "indirilemedi: HTTP 404" },
  ] }], { tarih: "T" });
  assert.match(html, /Kristal &lt;Avize&gt; &amp; Co/);
  assert.match(html, /left:25\.00%;top:25\.00%;width:50\.00%;height:50\.00%/);
  assert.match(html, /\(a\) --tuval kare/);
  assert.match(html, /\(b\) --tuval oran/);
  assert.match(html, /HATA: indirilemedi: HTTP 404/);
  assert.match(html, /1 ürün, 2 görsel · 1 uyarı/);
});

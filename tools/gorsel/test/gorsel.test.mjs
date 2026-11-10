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

/** Çıktıyı çözüp ham piksele erişir. */
const ham = async (buf) => {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, at: (x, y) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)] };
};
const yakin = (a, b, tol = 6) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

test("gri stüdyo zeminli + Trendyol düz beyaz şeritleri: yalnızca şeritler atılır, PAY YOK, kenarda beyaz çerçeve yok", async () => {
  // 1200x1800 beyaz; ortada 1200x1200 gri fotoğraf (y 300..1500), içinde koyu ürün
  const girdi = await resim(1200, 1800, "#ffffff", [[0, 300, 1200, 1200, "#808080"], [450, 600, 300, 600, "#2a1a0a"]]);
  const s = await isle(girdi, ["kare", "oran"]);
  assert.equal(s.durum, "kirpildi");
  assert.deepEqual(s.kutu, { left: 0, top: 300, width: 1200, height: 1200 }); // tam şerit sınırı: pay eklenmedi
  assert.equal(s.dolgu.tur, "renk");
  const k = await ham(s.ciktilar.kare.b);
  assert.deepEqual([k.w, k.h], [1200, 1200]);
  for (const [x, y] of [[0, 0], [k.w - 1, 0], [0, k.h - 1], [k.w - 1, k.h - 1], [k.w >> 1, 0], [k.w >> 1, k.h - 1], [0, k.h >> 1], [k.w - 1, k.h >> 1]]) assert.ok(yakin(k.at(x, y), [128, 128, 128]), `kenar ${x},${y}: ${k.at(x, y)}`);
  assert.ok(yakin(k.at(600, 600), [42, 26, 10], 12)); // ürün yerinde
  const o = await meta(s.ciktilar.oran.b);
  assert.deepEqual([o.width, o.height], [1200, 1200]);
});

test("gri zeminli, kare olmayan fotoğraf: pay yok, boş kısımlar kenar rengiyle dolar, kenara dayalı ürün parçası kaybolmaz", async () => {
  // 1200x1800 beyaz; 1200x800 gri fotoğraf (y 500..1300); kenara dayalı koyu parça (x 0..100)
  const girdi = await resim(1200, 1800, "#ffffff", [[0, 500, 1200, 800, "#707070"], [0, 700, 100, 400, "#101010"]]);
  const s = await isle(girdi, ["kare"]);
  assert.equal(s.durum, "kirpildi");
  assert.deepEqual(s.kutu, { left: 0, top: 500, width: 1200, height: 800 });
  assert.ok(["renk", "kenar"].includes(s.dolgu.tur));
  const k = await ham(s.ciktilar.kare.b);
  assert.deepEqual([k.w, k.h], [1200, 1200]);
  // fotoğraf ortada (y 200..1000): üst/alt dolgu gri
  assert.ok(yakin(k.at(600, 5), [112, 112, 112], 10), String(k.at(600, 5)));
  assert.ok(yakin(k.at(1195, 1195), [112, 112, 112], 10), String(k.at(1195, 1195)));
  assert.ok(yakin(k.at(50, 600), [16, 16, 16], 14));
  for (let x = 0; x < k.w; x += 97) assert.ok(k.at(x, 0).every((v) => v < 200) && k.at(x, k.h - 1).every((v) => v < 200), `beyaz çerçeve x=${x}`);
});

test("beyaz zeminli ürün (şeritli): HİÇ kırpılmaz, beyaz kare tuvale ortalanır, soluk kenarlarda piksel kaybı yok", async () => {
  // 600x900 beyaz; ürün + açık gri (#f0f0f0) ve soluk kristal (#fcfcfc) parçalar
  const girdi = await resim(600, 900, "#ffffff", [[100, 100, 400, 700, "#303030"], [60, 100, 40, 700, "#f0f0f0"], [500, 100, 30, 700, "#fcfcfc"]]);
  const s = await isle(girdi, ["kare"]);
  assert.equal(s.durum, "kirpilmadi");
  assert.equal(s.dolgu.tur, "beyaz");
  assert.deepEqual(s.kutu, { left: 0, top: 0, width: 600, height: 900 });
  const k = await ham(s.ciktilar.kare.b);
  assert.deepEqual([k.w, k.h], [900, 900]);
  const dx = 150; // (900-600)/2
  assert.ok(yakin(k.at(dx + 2, 2), [255, 255, 255], 3));
  assert.ok(yakin(k.at(dx + 80, 400), [240, 240, 240], 4)); // açık gri parça korundu
  assert.ok(yakin(k.at(dx + 515, 400), [252, 252, 252], 4)); // soluk kristal korundu
  assert.ok(yakin(k.at(dx + 300, 450), [48, 48, 48], 8));
  assert.ok(yakin(k.at(10, 450), [255, 255, 255], 2)); // yan dolgu beyaz
});

test("beyaza yakın (#f4f4f4) ve belirsiz (#e6e6e6) zeminli görsel: güvenli tarafta, kırpılmaz", async () => {
  for (const zemin of ["#f4f4f4", "#e6e6e6"]) {
    const s = await isle(await resim(800, 1200, "#ffffff", [[0, 100, 800, 1000, zemin], [350, 300, 100, 600, "#202020"]]), ["kare"]);
    assert.equal(s.durum, "kirpilmadi", zemin);
    assert.deepEqual(s.kutu, { left: 0, top: 0, width: 800, height: 1200 });
    const k = await ham(s.ciktilar.kare.b);
    assert.deepEqual([k.w, k.h], [1200, 1200]);
  }
});

test("saydam (PNG) görsel beyaza düzleşir ve beyaz zemin sayılır: kırpılmaz", async () => {
  const urun = await sharp({ create: { width: 200, height: 300, channels: 3, background: "#303030" } }).png().toBuffer();
  const png = await sharp({ create: { width: 500, height: 700, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: urun, left: 150, top: 200 }]).png().toBuffer();
  const s = await isle(png, ["kare"]);
  assert.equal(s.durum, "kirpilmadi");
  const k = await ham(s.ciktilar.kare.b);
  assert.deepEqual([k.w, k.h], [700, 700]);
  assert.ok(yakin(k.at(2, 2), [255, 255, 255], 2));
});

test("ortam fotoğrafı (kenarlar tek renk değil, kare değil): kırpılmaz, kare tuvale konur, dolgu kenar pikselinden uzanır", async () => {
  // 1000x1500; sol yarı koyu kahve, sağ yarı açık kahve, ortada nesne
  const girdi = await resim(1000, 1500, "#5a4a3a", [[500, 0, 500, 1500, "#b09878"], [300, 500, 400, 500, "#e8d8b8"]]);
  const s = await isle(girdi, ["kare"]);
  assert.equal(s.durum, "kirpilmadi");
  assert.deepEqual(s.kutu, { left: 0, top: 0, width: 1000, height: 1500 });
  assert.equal(s.dolgu.tur, "kenar");
  const k = await ham(s.ciktilar.kare.b);
  assert.deepEqual([k.w, k.h], [1500, 1500]);
  assert.ok(yakin(k.at(5, 700), [90, 74, 58], 10), String(k.at(5, 700))); // sol dolgu = sol kenar rengi
  assert.ok(yakin(k.at(1495, 700), [176, 152, 120], 10), String(k.at(1495, 700))); // sağ dolgu = sağ kenar rengi
  assert.ok(yakin(k.at(750, 750), [232, 216, 184], 10)); // nesne yerinde
});

test("tek renk stüdyo fotoğrafı (şeritsiz, kare değil): kırpılmaz, tek renkle doldurulur", async () => {
  const s = await isle(await resim(800, 1000, "#6a7a8a", [[300, 400, 200, 200, "#f0f0f0"]]), ["kare"]);
  assert.equal(s.durum, "kirpilmadi");
  assert.equal(s.dolgu.tur, "renk");
  const k = await ham(s.ciktilar.kare.b);
  assert.deepEqual([k.w, k.h], [1000, 1000]);
  assert.ok(yakin(k.at(3, 500), [106, 122, 138], 6));
});

test("tümüyle beyaz görsel hata vermez; küçük görsel büyütülmez; büyük sürüm ≤1600, küçük ≤800", async () => {
  const bos = await isle(await resim(600, 400, "#ffffff"), ["kare"]);
  assert.equal(bos.durum, "kirpilmadi");
  const buyuk = await isle(await resim(2400, 1800, "#ffffff", [[800, 600, 800, 600, "#202020"]]), ["kare"]);
  const b = await meta(buyuk.ciktilar.kare.b);
  const kk = await meta(buyuk.ciktilar.kare.k);
  assert.deepEqual([b.width, b.height, kk.width, kk.height], [1600, 1600, 800, 800]);
  const kucuk = await isle(await resim(300, 300, "#ffffff", [[100, 100, 100, 100, "#222222"]]), ["oran"]);
  assert.equal((await meta(kucuk.ciktilar.oran.b)).width, 300);
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
  assert.match(k.k, /-kr-v2-k.webp$/);
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
  assert.ok(manifestKaydi(manifest, "p1", T("a"), "kare").b.endsWith("-kr-v2-b.webp"));
  assert.equal(blob.dosyalar.size, 4);
});

test("onizlemeHtml: orijinal + önce + sonra, etiketler, kırpma kutusu yüzdeyle, metin kaçışlı", () => {
  const v = { dosya: "onizleme/x.webp", w: 800, h: 800, baytB: 90000, baytK: 30000 };
  const html = onizlemeHtml([{ modelCode: "7", title: "Kristal <Avize> & Co", gorseller: [
    { url: T("a"), orijinal: "onizleme/o.webp", orijinalBayt: 200000, kaynak: { w: 1200, h: 1800 }, kutu: { left: 0, top: 300, width: 1200, height: 1200 }, durum: "kirpildi", dolgu: { tur: "renk", renk: { r: 128, g: 128, b: 128 } }, once: { dosya: "onizleme/once.webp" }, tuval: "kare", sonra: v },
    { url: T("b"), orijinal: "onizleme/o2.webp", orijinalBayt: 1, kaynak: { w: 1000, h: 1000 }, kutu: { left: 0, top: 0, width: 1000, height: 1000 }, durum: "kirpilmadi", dolgu: { tur: "beyaz", renk: { r: 255, g: 255, b: 255 } }, once: null, tuval: "kare", sonra: v },
    { url: T("c"), hata: "indirilemedi: HTTP 404" },
  ] }], { tarih: "T" });
  assert.match(html, /Kristal &lt;Avize&gt; &amp; Co/);
  assert.ok(html.includes("left:0.00%;top:16.67%;width:100.00%;height:66.67%"));
  assert.ok(html.includes("Kırpıldı (yalnızca düz beyaz şeritler)"));
  assert.ok(html.includes("Kırpılmadı"));
  assert.ok(html.includes("dolgu: tek renk (rgb 128, 128, 128)"));
  assert.ok(html.includes("dolgu: beyaz"));
  assert.ok(html.includes("<strong>ÖNCE</strong> (şu an canlı, v1)"));
  assert.ok(html.includes("v1 yok"));
  assert.ok(html.includes("SONRA (v2, --tuval kare)"));
  assert.match(html, /HATA: indirilemedi: HTTP 404/);
  assert.match(html, /1 ürün, 3 görsel · 1 uyarı/);
});

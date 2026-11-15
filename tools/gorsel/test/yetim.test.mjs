import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ana } from "../yetim.mjs";
import { adresYolu, analizEt, csvUret, envanterTopla, metindenYollar, tabanYol, yolCoz } from "../lib/yetim-cekirdek.mjs";
import { yetimDb } from "../lib/yetim-db.mjs";

const AD = "https://abc123.public.blob.vercel-storage.com/";
const SIMDI = new Date("2026-11-15T12:00:00Z");
const gunOnce = (g) => new Date(SIMDI.getTime() - g * 86400000).toISOString();
const H = (c) => c.repeat(16);
const blob = (pathname, gun = 60, size = 1000) => ({ pathname, size, uploadedAt: gunOnce(gun) });
const ID = "cl9abcdefghij";
const p = (hash, son = "b") => `urun/${ID}/${H(hash)}-kr-v2-${son}.webp`;

// SAHTE Blob: yalnız liste (sayfalı). Yazma metodu yok.
const sahteListe = (hepsi, sayfa = 2) => ({ liste: async ({ cursor }) => { const bas = cursor ? Number(cursor) : 0; const blobs = hepsi.slice(bas, bas + sayfa); const son = bas + sayfa; return { blobs, cursor: son < hepsi.length ? String(son) : undefined, hasMore: son < hepsi.length }; } });
const sahteDb = ({ ref = [], ref2 = null, idler = [ID] } = {}) => { let n = 0; return { referansYollari: async () => new Set(++n === 1 || !ref2 ? ref : ref2), urunKimlikleri: async () => new Set(idler) }; };
const kos = (bloblar, o = {}) => ana({ blob: sahteListe(bloblar), db: sahteDb(o.db), dosyaYollari: o.dosya ?? new Map(), simdi: SIMDI });
const sinifOf = (s, yol) => s.satirlar.find((x) => x.yol === yol).sinif;

test("adres → yol: küçük harf alan, query/hash atılır, %-kodu çözülür; Blob dışı null", () => {
  assert.equal(adresYolu(`https://ABC.public.blob.vercel-storage.com/urun/x/a%20b-b.webp?v=1#z`), "urun/x/a b-b.webp");
  assert.equal(adresYolu("https://cdn.dsmcdn.com/x.jpg"), null);
  assert.deepEqual([...metindenYollar(`{"a":"${AD}urun/x/${H("a")}-b.webp","b":"[](${AD}urun/y/${H("b")}-k.webp)"}`)].sort(), [`urun/x/${H("a")}-b.webp`, `urun/y/${H("b")}-k.webp`]);
});

test("taban: -b/-k aynı taban; yol çözme: yükleme, v1, v2, tanınmayan", () => {
  assert.equal(tabanYol(p("a", "b")), tabanYol(p("a", "k")));
  assert.equal(yolCoz(`urun/${ID}/${"a".repeat(40)}-b.webp`).surum, "yukleme");
  assert.equal(yolCoz(`urun/${ID}/${H("a")}-or-b.webp`).surum, "v1");
  assert.equal(yolCoz(p("a")).surum, "v2");
  assert.equal(yolCoz("baska/dosya.png").tanindi, false);
  assert.equal(yolCoz(`urun/${ID}/garip-isim.webp`).tanindi, false);
});

test("images dizisindeki / imageMap değerindeki referans korunur (veritabanı yolu fark etmez)", async () => {
  const s = await kos([blob(p("a")), blob(p("b"))], { db: { ref: [p("a")] } });
  assert.equal(sinifOf(s, p("a")), "REFERANSLI");
  assert.equal(sinifOf(s, p("b")), "ADAY-S2");
});

test("-k yalnız Blob'da, -b veritabanında → ikisi de referanslı", async () => {
  const s = await kos([blob(p("a", "b")), blob(p("a", "k"))], { db: { ref: [p("a", "b")] } });
  assert.deepEqual(s.satirlar.map((x) => x.sinif), ["REFERANSLI", "REFERANSLI"]);
  assert.equal(s.ozet.aday, 0);
});

test("yedek/manifest/depo kaynağında geçen adres korunur", async () => {
  const s = await kos([blob(p("a"))], { dosya: new Map([[p("a"), "tools/gorsel/yedek-x-yaz.json"]]) });
  assert.equal(sinifOf(s, p("a")), "KORUNAN");
  assert.equal(s.ozet.aday, 0);
});

test("10 günlük dosya aday değil (taze); 45 günlük urun/yeni → S3", async () => {
  const yeni = `urun/yeni/${"c".repeat(40)}-b.webp`;
  const taze = `urun/yeni/${"d".repeat(40)}-b.webp`;
  const s = await kos([blob(p("a"), 10), blob(yeni, 45), blob(taze, 10)]);
  assert.equal(sinifOf(s, p("a")), "KORUNAN");
  assert.equal(sinifOf(s, yeni), "ADAY-S3");
  assert.equal(sinifOf(s, taze), "KORUNAN");
});

test("ürünü olmayan klasör → S1; v1 dosyası v2 karşılığı varken → S4; v2 yoksa S2", async () => {
  const yabanci = `urun/olmayanurun1/${H("e")}-kr-v2-b.webp`;
  const v1 = `urun/${ID}/${H("f")}-kr-b.webp`;
  const v2 = `urun/${ID}/${H("f")}-kr-v2-b.webp`;
  const yalnizV1 = `urun/${ID}/${H("9")}-or-b.webp`;
  const s = await kos([blob(yabanci), blob(v1), blob(v2), blob(yalnizV1)], { db: { ref: [v2] } });
  assert.equal(sinifOf(s, yabanci), "ADAY-S1");
  assert.equal(sinifOf(s, v1), "ADAY-S4");
  assert.equal(sinifOf(s, v2), "REFERANSLI");
  assert.equal(sinifOf(s, yalnizV1), "ADAY-S2");
});

test("tanınmayan yol aday olmaz (urun/ dışı ve desen dışı)", async () => {
  const s = await kos([blob("baska/logo.png"), blob(`urun/${ID}/garip.webp`)]);
  assert.deepEqual(s.satirlar.map((x) => x.sinif), ["TANINMAYAN", "TANINMAYAN"]);
  assert.equal(s.ozet.aday, 0);
});

test("ikinci kontrolde yeni referans çıkan dosya adaydan düşer", async () => {
  const s = await kos([blob(p("a"))], { db: { ref: [], ref2: [p("a")] } });
  assert.equal(sinifOf(s, p("a")), "KORUNAN");
  assert.match(s.satirlar[0].neden, /ikinci kontrol/);
});

test("sayfalama: tüm sayfalar toplanır; sayfa sınırı aşılırsa rapor üretilmez", async () => {
  const hepsi = Array.from({ length: 7 }, (_, i) => blob(`x/${i}.png`));
  assert.equal((await envanterTopla(sahteListe(hepsi, 2))).length, 7);
  await assert.rejects(() => envanterTopla(sahteListe(hepsi, 2), { enCokSayfa: 2 }), /sayfa sınırı/);
});

test("özet ve CSV: sayılar ve boyut; virgüllü yol kaçırılır", () => {
  const { ozet, satirlar } = analizEt({ bloblar: [blob(p("a"), 60, 2048), blob("a,b.png", 60, 1)], dbYollari: [], dosyaYollari: [], urunIdleri: [ID], simdi: SIMDI });
  assert.equal(ozet.toplam, 2); assert.equal(ozet.toplamBayt, 2049); assert.equal(ozet.aday, 1); assert.equal(ozet.adayBayt, 2048); assert.equal(ozet.tanimayan, 1);
  assert.match(csvUret(satirlar), /"a,b\.png"/);
});

// --- Veritabanı katmanı: sahte pg istemcisi; salt okunur ve dinamik sütun keşfi ---
function sahteIstemci({ sutunlar, adresler = {} }) {
  const sorgular = [];
  return {
    sorgular,
    async query(sql, params) {
      sorgular.push({ sql, params });
      if (/information_schema\.columns/.test(sql)) return { rows: sutunlar };
      if (/regexp_matches/.test(sql)) { const m = /FROM "([^"]+)", regexp_matches\("([^"]+)"/.exec(sql); return { rows: (adresler[`${m[1]}.${m[2]}`] ?? []).map((adres) => ({ adres })) }; }
      if (/FROM "Product"/.test(sql)) return { rows: [{ id: ID }] };
      return { rows: [] };
    },
  };
}

test("DB katmanı: işlem salt okunur başlar, hep geri alınır; yalnız SELECT/BEGIN/ROLLBACK çalışır", async () => {
  const c = sahteIstemci({ sutunlar: [{ tablo: "Product", sutun: "images" }], adresler: { "Product.images": [`${AD}${p("a")}`] } });
  const yollar = await yetimDb(c).referansYollari();
  assert.deepEqual([...yollar], [p("a")]);
  assert.equal(c.sorgular[0].sql, "BEGIN TRANSACTION READ ONLY");
  assert.equal(c.sorgular.at(-1).sql, "ROLLBACK");
  assert.ok(!c.sorgular.some((q) => /COMMIT/i.test(q.sql)));
  for (const q of c.sorgular) assert.match(q.sql.trim(), /^(SELECT|BEGIN TRANSACTION READ ONLY|ROLLBACK)/);
});

test("DB katmanı: sütunlar information_schema'dan keşfedilir (homepageConfig gibi gömülü adresler dahil), liste elle yazılmaz", async () => {
  const c = sahteIstemci({ sutunlar: [{ tablo: "SiteConfig", sutun: "homepageConfig" }, { tablo: "YeniTablo", sutun: "not" }], adresler: { "SiteConfig.homepageConfig": [`${AD}${p("b")}`], "YeniTablo.not": [`${AD}${p("c")}`] } });
  const yollar = await yetimDb(c).referansYollari();
  assert.deepEqual([...yollar].sort(), [p("b"), p("c")].sort());
  assert.ok(c.sorgular.some((q) => /"SiteConfig"/.test(q.sql)) && c.sorgular.some((q) => /"YeniTablo"/.test(q.sql)));
  // desen SQL'e yapıştırılmaz, parametredir
  assert.ok(c.sorgular.filter((q) => /regexp_matches/.test(q.sql)).every((q) => /blob/.test(q.params[0]) && !/blob/.test(q.sql)));
});

test("DB katmanı: ürün kimlikleri yalnız id okur", async () => {
  const c = sahteIstemci({ sutunlar: [] });
  assert.deepEqual([...(await yetimDb(c).urunKimlikleri())], [ID]);
  assert.match(c.sorgular[1].sql, /SELECT id FROM "Product"/);
});

// --- Statik denetim: araç dosyaları yazma/silme çağrısı içermez ---
test("kaynak denetimi: put/del/copy çağrısı ve veri yazan SQL yok; @vercel/blob'dan yalnız list içe aktarılır", () => {
  const kok = join(dirname(fileURLToPath(import.meta.url)), "..");
  for (const f of ["yetim.mjs", "lib/yetim-cekirdek.mjs", "lib/yetim-db.mjs", "lib/yetim-dosya.mjs"]) {
    const kaynak = readFileSync(join(kok, f), "utf8");
    assert.doesNotMatch(kaynak, /\b(put|del|copy|head)\s*\(/, `${f}: Blob yazma/silme çağrısı`);
    assert.doesNotMatch(kaynak, /\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE)\b/i, `${f}: veri yazan SQL`);
    for (const m of kaynak.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@vercel\/blob"/g)) assert.equal(m[1].trim(), "list", `${f}: yalnız list`);
  }
  assert.ok(readdirSync(kok).includes("yetim.mjs"));
});

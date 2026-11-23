// "N adet" paket üründen "1 Adet" tekli ürün oluşturur (pasif). VARSAYILAN: ÖNİZLEME (yalnız SELECT).
//   node --env-file=.env tools/tekli-urun-olustur.mjs --kaynak "<başlıktan parça>" | --kaynak-id <id> --paket-adedi 4 --fiyat 99 [--canli] [--uygula]
// TOPLU: node --env-file=.env tools/tekli-urun-olustur.mjs --liste urunler.csv [--ayrinti] [--canli] [--uygula]
//   CSV sütunları (başlık adıyla): urun_id, paket_adedi, fiyat. Tüm satırlar TEK transaction'da; HATA satırı varsa hiçbir şey yazılmaz.
// Hedef: GORSEL_DATABASE_URL; canlı DATABASE_URL yalnız --canli ile. --uygula: önizleme + "EVET" onayı + tek transaction'da 1 Product + 1 ProductVariation CREATE.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { baglan } from "./gorsel/lib/db.mjs";
import { calistir, evetSor, ortamYukle } from "./gorsel/lib/ortam.mjs";
import { argDogrula, baslikDonustur, fiyatSayisi, kaynakBul, kaynakIdBul, planOlustur, sadelestir } from "./tekli-urun/hesapla.mjs";
import { csvAyristir, satirDogrula } from "./tekli-urun/liste.mjs";

export function argumanlar(argv) {
  const a = { kaynak: "", kaynakId: "", paketAdedi: "", fiyat: "", liste: "", ayrinti: false, canli: false, uygula: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--canli") a.canli = true;
    else if (k === "--uygula") a.uygula = true;
    else if (k === "--ayrinti") a.ayrinti = true;
    else if (k === "--liste") a.liste = argv[++i] ?? "";
    else if (k === "--kaynak-id") a.kaynakId = argv[++i] ?? "";
    else if (k === "--kaynak") a.kaynak = argv[++i] ?? "";
    else if (k === "--paket-adedi") a.paketAdedi = argv[++i] ?? "";
    else if (k === "--fiyat") a.fiyat = argv[++i] ?? "";
    else throw new Error(`Bilinmeyen argüman: ${k}`);
  }
  return a;
}

const URUN_ALAN = ["title", "description", "category", "brand", "imageUrl", "images", "pickupDiscountPct", "transferDiscountPct", "couponAllowed", "basePrice", "listPrice", "active", "isFeatured", "isBestSeller"];
const VAR_ALAN = ["variationType", "variationValue", "extraPrice", "stock", "barcode", "stockCode", "salePrice", "listPrice", "syncSnapshot", "syncStock", "images", "position"];
const TIP = { images: "text[]", syncSnapshot: "jsonb" };
const par = (alan, i) => `$${i}::${TIP[alan] ?? ({ basePrice: "float8", listPrice: "float8", extraPrice: "float8", salePrice: "float8", pickupDiscountPct: "float8", transferDiscountPct: "float8", stock: "int", syncStock: "int", position: "int", active: "boolean", isFeatured: "boolean", isBestSeller: "boolean", couponAllowed: "boolean" }[alan] ?? "text")}`;

async function ekle(client, { urun, varyasyon }) {
  const pid = randomUUID();
  const vid = randomUUID();
  const r = await client.query(
    `INSERT INTO "Product" (id, ${URUN_ALAN.map((k) => `"${k}"`).join(", ")}, "createdAt", "updatedAt")
     SELECT $1::text, ${URUN_ALAN.map((k, i) => par(k, i + 2)).join(", ")}, now(), now()
     WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE title = $2::text)`,
    [pid, ...URUN_ALAN.map((k) => urun[k])],
  );
  if (r.rowCount !== 1) throw new Error(`Aynı başlıkla ürün arada oluşmuş; hiçbir şey yazılmadı: ${urun.title}`);
  await client.query(
    `INSERT INTO "ProductVariation" (id, "productId", ${VAR_ALAN.map((k) => `"${k}"`).join(", ")})
     VALUES ($1::text, $2::text, ${VAR_ALAN.map((k, i) => par(k, i + 3)).join(", ")})`,
    [vid, pid, ...VAR_ALAN.map((k) => (k === "syncSnapshot" && varyasyon[k] != null ? JSON.stringify(varyasyon[k]) : varyasyon[k]))],
  );
  return { productId: pid, variationId: vid };
}

/** pg erişimi (gerçek). Testlerde sahte db verilir. */
export function pgDb(client) {
  return {
    async urunler() {
      const { rows } = await client.query(`SELECT p.id, p.title, p.active, COALESCE(SUM(v.stock), 0)::int AS stock
        FROM "Product" p LEFT JOIN "ProductVariation" v ON v."productId" = p.id GROUP BY p.id ORDER BY p.title`);
      return rows;
    },
    async urun(id) {
      return (await client.query(`SELECT * FROM "Product" WHERE id = $1`, [id])).rows[0];
    },
    async varyasyonlar(id) {
      return (await client.query(`SELECT * FROM "ProductVariation" WHERE "productId" = $1 ORDER BY position, id`, [id])).rows;
    },
    /** Tek transaction. Aynı başlık arada oluştuysa (NOT EXISTS) hiçbir şey yazılmaz. */
    async olustur(plan) {
      return (await this.olusturToplu([plan]))[0];
    },
    /** Hepsi tek transaction: ya hepsi ya hiçbiri. Dönüş: [{ productId, variationId }]. */
    async olusturToplu(planlar) {
      await client.query("BEGIN");
      try {
        const sonuc = [];
        for (const p of planlar) sonuc.push(await ekle(client, p));
        await client.query("COMMIT");
        return sonuc;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      }
    },
  };
}

function onizlemeYaz(plan, kaynak, log) {
  const { urun, varyasyon, aciklama, uyarilar } = plan;
  log(`\nKaynak: ${kaynak.id} | ${kaynak.title}`);
  log("YENİ ÜRÜN (pasif):");
  log(`  başlık: ${urun.title}`);
  log(`  kategori: ${urun.category} · marka: ${urun.brand ?? "—"} · görsel: ${urun.images.length} adres`);
  log(`  fiyat: ${urun.basePrice} TL · liste fiyatı: ${urun.listPrice ?? "yok"} · kupon: ${urun.couponAllowed ? "evet" : "hayır"}`);
  log(`  mağaza indirimi %: ${urun.pickupDiscountPct ?? "varsayılan"} · havale indirimi %: ${urun.transferDiscountPct ?? "varsayılan"}`);
  log(`  varyasyon: ${varyasyon.variationType} = ${varyasyon.variationValue} · stok: ${varyasyon.stock} · barkod/stok kodu: boş`);
  log(`\nAçıklama değişiklikleri (${aciklama.degisiklikler.length}):`);
  for (const d of aciklama.degisiklikler) log(`  satır ${d.satir}\n    önce : ${d.once}\n    sonra: ${d.sonra}`);
  if (aciklama.elle.length > 0) {
    log(`\nELLE BAKILACAKLAR (değiştirilmedi, ${aciklama.elle.length}):`);
    for (const e of aciklama.elle) log(`  satır ${e.satir}: …${e.parca}…`);
  }
  log("\nNotlar:");
  for (const u of uyarilar) log(`  - ${u}`);
}

/** Akış; db ve evet enjekte edilebilir (testte sahte). Dönüş: "onizleme" | "yazildi" | "iptal" | "durdu". */
export async function akis({ db, args, evet = evetSor, log = console.log, hedefMetni = "", oku = (yol) => readFileSync(yol, "utf8") }) {
  if (args.liste) return listeAkis({ db, args, evet, log, hedefMetni, oku });
  const h = argDogrula(args);
  if (h.length > 0) {
    for (const m of h) log(`HATA: ${m}`);
    return "durdu";
  }
  const n = Number(args.paketAdedi);
  const fiyat = fiyatSayisi(args.fiyat);
  const urunler = await db.urunler();
  let b;
  if (args.kaynakId) {
    const k = kaynakIdBul(urunler, args.kaynakId);
    if (k.durum !== "tek") {
      log(k.durum === "yok" ? `Kaynak ürün bulunamadı: ${args.kaynakId}` : `Kaynak ürün pasif: ${args.kaynakId} | ${k.urun.title}`);
      return "durdu";
    }
    b = { durum: "tek", urun: k.urun };
  } else b = kaynakBul(urunler, args.kaynak);
  if (b.durum !== "tek") {
    log(b.durum === "yok" ? `Eşleşen ürün yok: "${args.kaynak}"` : `${b.adaylar.length} ürün eşleşti; --kaynak'ı daraltın:`);
    for (const u of b.adaylar) log(`  ${u.id} | ${u.title} | aktif: ${u.active} | stok: ${u.stock}`);
    return "durdu";
  }
  const kaynak = await db.urun(b.urun.id);
  const varyasyonlar = await db.varyasyonlar(b.urun.id);
  const plan = planOlustur({ kaynak, varyasyonlar, mevcutBasliklar: urunler.map((u) => u.title), paketAdedi: n, fiyat });
  if (plan.hata) {
    log(`DUR: ${plan.hata}`);
    for (const v of plan.varyasyonlar ?? []) log(`  ${v.id} | ${v.variationType}: ${v.variationValue} | stok: ${v.stock}`);
    return "durdu";
  }
  onizlemeYaz(plan, kaynak, log);
  if (!args.uygula) {
    log(`\nÖNİZLEME: veritabanına yazılmadı. Oluşturmak için --uygula ekleyin.`);
    return "onizleme";
  }
  log("\n--- ONAY ÖNCESİ ÖNİZLEME TEKRARI ---");
  onizlemeYaz(plan, kaynak, log);
  if (!(await evet(`${hedefMetni}1 ürün + 1 varyasyon OLUŞTURULACAK (mevcut satırlara dokunulmaz), devam için EVET yazın:`))) {
    log("Onay verilmedi, hiçbir şey yazılmadı.");
    return "iptal";
  }
  const s = await db.olustur(plan);
  log(`\nOluşturuldu: ürün ${s.productId} (pasif), varyasyon ${s.variationId}. Admin panelden kontrol edip açın; vitrin önbelleği için bir ürünü kaydedin.`);
  return "yazildi";
}

/** Toplu mod. Dönüş: "onizleme" | "yazildi" | "iptal" | "durdu" | "bos". */
async function listeAkis({ db, args, evet, log, hedefMetni, oku }) {
  if (args.kaynak || args.kaynakId || args.paketAdedi || args.fiyat) {
    log("HATA: --liste ile --kaynak/--kaynak-id/--paket-adedi/--fiyat birlikte verilemez.");
    return "durdu";
  }
  let metin;
  try {
    metin = oku(args.liste);
  } catch (e) {
    log(`HATA: liste dosyası okunamadı: ${e instanceof Error ? e.message : String(e)}`);
    return "durdu";
  }
  const csv = csvAyristir(metin);
  if (csv.hata) {
    log(`HATA: ${csv.hata}`);
    return "durdu";
  }
  log(`Liste: ${csv.satirlar.length} ürün satırı · hedef: ${hedefMetni.replace(/:\s*$/, "").trim() || "veritabanı"}`);
  const urunler = await db.urunler();
  const mevcut = urunler.map((u) => u.title);
  const listedeki = new Set();
  const sonuclar = [];
  for (const s of csv.satirlar) {
    const d = satirDogrula(s);
    if (d.hata) { sonuclar.push({ satir: s.satir, durum: "HATA", neden: d.hata }); continue; }
    const k = kaynakIdBul(urunler, d.id);
    if (k.durum !== "tek") { sonuclar.push({ satir: s.satir, durum: "HATA", neden: k.durum === "yok" ? `kaynak bulunamadı: ${d.id}` : `kaynak pasif: ${d.id}` }); continue; }
    const kaynak = await db.urun(d.id);
    const varyasyonlar = await db.varyasyonlar(d.id);
    const b = baslikDonustur(kaynak.title, d.n);
    if (b.ok && listedeki.has(sadelestir(b.title))) { sonuclar.push({ satir: s.satir, durum: "HATA", neden: `aynı yeni başlık listede iki kez: ${b.title}` }); continue; }
    const plan = planOlustur({ kaynak, varyasyonlar, mevcutBasliklar: mevcut, paketAdedi: d.n, fiyat: d.fiyat });
    if (plan.mevcut) { sonuclar.push({ satir: s.satir, durum: "ATLANDI", neden: plan.hata }); continue; }
    if (plan.hata) { sonuclar.push({ satir: s.satir, durum: "HATA", neden: plan.hata }); continue; }
    listedeki.add(sadelestir(plan.urun.title));
    sonuclar.push({ satir: s.satir, durum: "OK", kaynak, plan });
  }
  for (const r of sonuclar) {
    if (r.durum === "OK") {
      const { urun, varyasyon, aciklama } = r.plan;
      log(`satır ${r.satir} | OK | ${r.kaynak.title} → ${urun.title} | ${urun.basePrice} TL | stok ${varyasyon.stock}${aciklama.elle.length > 0 ? ` | elle bakılacak: ${aciklama.elle.length}` : ""}`);
      if (args.ayrinti) onizlemeYaz(r.plan, r.kaynak, log);
    } else log(`satır ${r.satir} | ${r.durum} | ${r.neden}`);
  }
  const say = (d) => sonuclar.filter((r) => r.durum === d).length;
  const ok = sonuclar.filter((r) => r.durum === "OK");
  log(`\nÖzet: ${say("OK")} OK, ${say("ATLANDI")} ATLANDI, ${say("HATA")} HATA`);
  if (!args.uygula) {
    log("ÖNİZLEME: veritabanına yazılmadı. Oluşturmak için --uygula ekleyin.");
    return "onizleme";
  }
  if (say("HATA") > 0) {
    log("DUR: HATA satırı var; hiçbir şey yazılmadı. Listeyi düzeltip yeniden çalıştırın.");
    return "durdu";
  }
  if (ok.length === 0) {
    log("Oluşturulacak ürün yok; hiçbir şey yazılmadı.");
    return "bos";
  }
  if (!(await evet(`${hedefMetni}${ok.length} ürün + ${ok.length} varyasyon TEK transaction'da OLUŞTURULACAK (mevcut satırlara dokunulmaz), devam için EVET yazın:`))) {
    log("Onay verilmedi, hiçbir şey yazılmadı.");
    return "iptal";
  }
  const yazilan = await db.olusturToplu(ok.map((r) => r.plan));
  log(`\nOluşturuldu: ${yazilan.length} ürün (pasif). Başlık → ürün id:`);
  ok.forEach((r, i) => log(`  ${r.plan.urun.title} → ${yazilan[i].productId}`));
  log("Admin panelden kontrol edip açın; vitrin önbelleği için bir ürünü kaydedin.");
  return "yazildi";
}

const anaMi = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (anaMi) {
  calistir(async () => {
    const args = argumanlar(process.argv.slice(2));
    ortamYukle();
    const { client, sunucu, dal, e2e } = await baglan({ canli: args.canli });
    try {
      console.log(`Veritabanı: sunucu ${sunucu} · dal: ${dal}`);
      if (!e2e) console.log("UYARI: hedef PRODUCTION kabul ediliyor.");
      const sonuc = await akis({ db: pgDb(client), args, hedefMetni: e2e ? "e2e-test dalına: " : "production'a: " });
      if (sonuc === "durdu" || sonuc === "iptal") process.exitCode = 1;
    } finally {
      await client.end().catch(() => {});
    }
  });
}

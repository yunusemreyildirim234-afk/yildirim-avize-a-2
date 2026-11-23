// "N adet" paket üründen "1 Adet" tekli ürün oluşturur (pasif). VARSAYILAN: ÖNİZLEME (yalnız SELECT).
//   node --env-file=.env tools/tekli-urun-olustur.mjs --kaynak "<başlıktan parça>" --paket-adedi 4 --fiyat 99 [--canli] [--uygula]
// Hedef: GORSEL_DATABASE_URL; canlı DATABASE_URL yalnız --canli ile. --uygula: önizleme + "EVET" onayı + tek transaction'da 1 Product + 1 ProductVariation CREATE.
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { baglan } from "./gorsel/lib/db.mjs";
import { calistir, evetSor, ortamYukle } from "./gorsel/lib/ortam.mjs";
import { argDogrula, fiyatSayisi, kaynakBul, planOlustur } from "./tekli-urun/hesapla.mjs";

export function argumanlar(argv) {
  const a = { kaynak: "", paketAdedi: "", fiyat: "", canli: false, uygula: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--canli") a.canli = true;
    else if (k === "--uygula") a.uygula = true;
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
    async olustur({ urun, varyasyon }) {
      const pid = randomUUID();
      const vid = randomUUID();
      await client.query("BEGIN");
      try {
        const degerler = URUN_ALAN.map((k) => urun[k]);
        const r = await client.query(
          `INSERT INTO "Product" (id, ${URUN_ALAN.map((k) => `"${k}"`).join(", ")}, "createdAt", "updatedAt")
           SELECT $1::text, ${URUN_ALAN.map((k, i) => par(k, i + 2)).join(", ")}, now(), now()
           WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE title = $2::text)`,
          [pid, ...degerler],
        );
        if (r.rowCount !== 1) throw new Error("Aynı başlıkla ürün arada oluşmuş; hiçbir şey yazılmadı.");
        await client.query(
          `INSERT INTO "ProductVariation" (id, "productId", ${VAR_ALAN.map((k) => `"${k}"`).join(", ")})
           VALUES ($1::text, $2::text, ${VAR_ALAN.map((k, i) => par(k, i + 3)).join(", ")})`,
          [vid, pid, ...VAR_ALAN.map((k) => (k === "syncSnapshot" && varyasyon[k] != null ? JSON.stringify(varyasyon[k]) : varyasyon[k]))],
        );
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      }
      return { productId: pid, variationId: vid };
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
export async function akis({ db, args, evet = evetSor, log = console.log, hedefMetni = "" }) {
  const h = argDogrula(args);
  if (h.length > 0) {
    for (const m of h) log(`HATA: ${m}`);
    return "durdu";
  }
  const n = Number(args.paketAdedi);
  const fiyat = fiyatSayisi(args.fiyat);
  const urunler = await db.urunler();
  const b = kaynakBul(urunler, args.kaynak);
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

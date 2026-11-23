// Tekli ürün aracının SAF fonksiyonları (veritabanı/dosya/ağ yok).

const TR = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** Büyük/küçük harf ve Türkçe karakter duyarsız karşılaştırma biçimi. */
export function sadelestir(s) {
  return String(s ?? "")
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, (c) => TR[c])
    .replace(/\s+/g, " ")
    .trim();
}

/** Komut satırı değerlerini doğrular. Hata mesajları dizisi döner (boş = geçerli). */
export function argDogrula({ kaynak, kaynakId, paketAdedi, fiyat }) {
  const h = [];
  const kVar = Boolean(kaynak && String(kaynak).trim());
  const idVar = Boolean(kaynakId && String(kaynakId).trim());
  if (kVar && idVar) h.push("--kaynak ve --kaynak-id birlikte verilemez.");
  else if (!kVar && !idVar) h.push("--kaynak gerekli (başlıktan bir parça) ya da --kaynak-id (ürün kimliği).");
  if (!/^\d+$/.test(String(paketAdedi ?? "")) || Number(paketAdedi) < 2) h.push("--paket-adedi 2 veya daha büyük bir tam sayı olmalı.");
  const f = Number(String(fiyat ?? "").replace(",", "."));
  if (!/^\d+([.,]\d+)?$/.test(String(fiyat ?? "")) || !Number.isFinite(f) || f <= 0) h.push("--fiyat sıfırdan büyük bir sayı olmalı.");
  return h;
}

export function fiyatSayisi(fiyat) {
  return Number(String(fiyat).replace(",", "."));
}

/** urunler: [{ id, title, active, stock }]. Tam 1 eşleşme gerekir. */
export function kaynakBul(urunler, parca) {
  const p = sadelestir(parca);
  const adaylar = urunler.filter((u) => sadelestir(u.title).includes(p));
  if (adaylar.length === 1) return { durum: "tek", urun: adaylar[0], adaylar };
  return { durum: adaylar.length === 0 ? "yok" : "cok", adaylar };
}

/** Kaynağı kimlikle seçer. Yoksa "yok", pasifse "pasif". */
export function kaynakIdBul(urunler, id) {
  const u = urunler.find((x) => x.id === String(id).trim());
  if (!u) return { durum: "yok" };
  if (!u.active) return { durum: "pasif", urun: u };
  return { durum: "tek", urun: u };
}

const adetRe =(n) => new RegExp(`(?<![\\d.,])${n}\\s*adet(?!\\p{L})`, "iu");

/** Başlıkta ilk "<n> adet" ifadesini "1 Adet" yapar (parantez/boşluk düzeni korunur). */
export function baslikDonustur(title, n) {
  const re = adetRe(n);
  if (!re.test(title)) return { ok: false, title: null };
  return { ok: true, title: title.replace(re, "1 Adet") };
}

// "4 adet ampul/duy/…" paketi değil bileşen sayısıdır; elle bakılır
const BILESEN = /^\s+(ampul|ampül|duy|lamba|led|kollu|kol|ışık|isik|çift|cift)/iu;

/**
 * Açıklamada adet anlamındaki "<n> adet" → "1 adet". Bileşen sayısı gibi görünenler ile
 * kalan tüm tek başına <n> geçişleri (4'lü, 4 W, 4 cm …) DEĞİŞTİRİLMEZ, "elle" listesine girer.
 */
export function aciklamaDonustur(desc, n) {
  const satirlar = String(desc ?? "").split(/\r?\n/);
  const degisiklikler = [];
  const elle = [];
  const bul = new RegExp(`(?<![\\d.,])${n}\\s*adet(?!\\p{L})`, "giu");
  const kalan = new RegExp(`(?<![\\d.,])${n}(?!\\d|[.,]\\d)`, "g");
  const yeni = satirlar.map((satir, i) => {
    const s = satir.replace(bul, (m, ...r) => {
      const offset = r[r.length - 2];
      return BILESEN.test(satir.slice(offset + m.length)) ? m : "1 adet";
    });
    if (s !== satir) degisiklikler.push({ satir: i + 1, once: satir, sonra: s });
    for (const m of s.matchAll(kalan)) {
      const bas = Math.max(0, m.index - 25);
      elle.push({ satir: i + 1, parca: s.slice(bas, m.index + 30).trim() });
    }
    return s;
  });
  return { yeni: yeni.join("\n"), degisiklikler, elle };
}

/** Nihai birim fiyat (lib/pricing.ts'te adet kademesi yoksa): basePrice + extraPrice; salePrice yalnız Trendyol verisidir. */
export function birimFiyat(urun, varyasyon) {
  return (urun.basePrice ?? 0) + (varyasyon.extraPrice ?? 0);
}

export function listPriceHesapla(listPrice, n, fiyat) {
  if (!listPrice || listPrice <= 0) return null;
  const r = Math.round(listPrice / n);
  return r > fiyat ? r : null;
}

/** Ürün/varyasyon görsellerinden iç (ProductImage tablosundan servis edilen) adres sayısı. */
export function icGorselSayisi(urun, varyasyonlar) {
  const hepsi = [urun.imageUrl, ...(urun.images ?? []), ...varyasyonlar.flatMap((v) => v.images ?? [])];
  return new Set(hepsi.filter((u) => typeof u === "string" && u.startsWith("/api/product-images/"))).size;
}

/**
 * Önizleme + yazma planı. girdi: { kaynak (Product satırı), varyasyonlar, mevcutBasliklar, paketAdedi (sayı), fiyat (sayı) }.
 * Sonuç: { hata } veya { urun, varyasyon, aciklama, uyarilar }.
 */
export function planOlustur({ kaynak, varyasyonlar, mevcutBasliklar, paketAdedi: n, fiyat }) {
  if (varyasyonlar.length !== 1) return { hata: `Kaynak ürünün ${varyasyonlar.length} varyasyonu var; tam 1 olmalı. Karar sahibe ait.`, varyasyonlar };
  const v = varyasyonlar[0];
  const b = baslikDonustur(kaynak.title, n);
  if (!b.ok) return { hata: `Başlıkta "${n} adet" ifadesi bulunamadı: ${kaynak.title}` };
  const yeniBaslik = sadelestir(b.title);
  if (mevcutBasliklar.some((t) => sadelestir(t) === yeniBaslik)) return { hata: `Bu başlıkla ürün zaten var: ${b.title}`, mevcut: true };
  if (!Number.isInteger(v.stock) || v.stock < 0) return { hata: `Kaynak varyasyon stoğu geçersiz: ${v.stock}` };

  const varYeni = {
    variationType: v.variationType,
    variationValue: v.variationValue,
    extraPrice: 0,
    stock: v.stock * n,
    barcode: null,
    stockCode: null,
    salePrice: null,
    listPrice: null,
    syncSnapshot: null,
    syncStock: null,
    images: [...(v.images ?? [])],
    position: 0,
  };
  const urunYeni = {
    title: b.title,
    description: null,
    category: kaynak.category,
    brand: kaynak.brand ?? null,
    imageUrl: kaynak.imageUrl ?? null,
    images: [...(kaynak.images ?? [])],
    pickupDiscountPct: kaynak.pickupDiscountPct ?? null,
    transferDiscountPct: kaynak.transferDiscountPct ?? null,
    couponAllowed: kaynak.couponAllowed ?? true,
    basePrice: fiyat,
    listPrice: listPriceHesapla(kaynak.listPrice, n, fiyat),
    active: false,
    isFeatured: false,
    isBestSeller: false,
    // kopyalanmayanlar
    trendyolMainId: null,
    modelCode: null,
    trendyolCategory: null,
    trendyolUrl: null,
    syncSnapshot: null,
    lastSyncedAt: null,
    bulkMinQty: null,
    bulkDiscountType: null,
    bulkDiscountValue: null,
    bulkTiers: null,
    ebat: null,
  };
  const birim = birimFiyat(urunYeni, varYeni);
  if (birim !== fiyat) return { hata: `Nihai birim fiyat ${birim}, beklenen ${fiyat}; durduruldu.` };

  const a = aciklamaDonustur(kaynak.description, n);
  urunYeni.description = kaynak.description == null ? null : a.yeni;

  const uyarilar = [];
  if (kaynak.ebat) uyarilar.push(`Kaynakta ebat var ("${kaynak.ebat}"); yeni üründe BOŞ bırakıldı, elle girin.`);
  if (kaynak.videoUrl) uyarilar.push("Kaynakta video adresi var; kopyalanmadı (paket videosu olabilir).");
  const ic = icGorselSayisi(kaynak, varyasyonlar);
  if (ic > 0) uyarilar.push(`${ic} iç görsel adresi (ProductImage) kaynakla paylaşılıyor: kaynak ürün silinirse bu görseller de silinir.`);
  uyarilar.push("Yeni ürün Trendyol'a bağlı DEĞİL (eşitleme dışı).");
  uyarilar.push("Kaynak paketin stoğu ayrıca düşmedi: aynı fiziksel mal iki üründe sayılır, stoğu elle düzeltin.");
  return { urun: urunYeni, varyasyon: varYeni, aciklama: a, uyarilar };
}

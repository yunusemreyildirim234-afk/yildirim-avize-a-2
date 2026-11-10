// Testler için bellek içi SAHTE veritabanı ve SAHTE Blob istemcisi. Gerçek veritabanına/Blob'a/ağa hiç bağlanılmaz.
const ayni = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** lib/db.mjs → pgDb ile aynı sözleşme ve aynı KOŞULLU yazma kuralı. oncePartiden: yarış benzetimi için kanca. */
export function sahteDb(urunler, { oncePartiden = null } = {}) {
  const veri = new Map(structuredClone(urunler).map((u) => [u.id, { imageMap: {}, variations: [], imageUrl: null, ...u }]));
  let parti = 0;
  return {
    veri,
    partiSayisi: () => parti,
    async urunleriOku(ids) {
      const liste = ids ? ids.map((id) => veri.get(id)).filter(Boolean) : [...veri.values()];
      return structuredClone(liste);
    },
    async partiYaz(planlar) {
      parti++;
      if (oncePartiden) oncePartiden(veri, parti);
      return planlar.map((p) => {
        const u = veri.get(p.id);
        if (!u || !ayni(u.images, p.eski.images) || (u.imageUrl ?? null) !== p.eski.imageUrl) return { id: p.id, yazildi: false, varyasyonAtlanan: 0 };
        u.images = [...p.yeni.images];
        u.imageUrl = p.yeni.imageUrl;
        if (p.imageMapEk) u.imageMap = { ...u.imageMap, ...p.imageMapEk };
        let varyasyonAtlanan = 0;
        for (const v of p.varyasyonlar) {
          const hedef = u.variations.find((x) => x.id === v.id);
          if (hedef && ayni(hedef.images, v.eski)) hedef.images = [...v.yeni];
          else varyasyonAtlanan++;
        }
        return { id: p.id, yazildi: true, varyasyonAtlanan };
      });
    },
  };
}

/** Üzerine yazma KAPALI sahte Blob: aynı yola ikinci put hata verir (gerçek davranış). */
export function sahteBlob({ putHatasi = null } = {}) {
  const dosyalar = new Map();
  let putSayisi = 0;
  const adres = (yol) => `https://sahte.public.blob.vercel-storage.com/${yol}`;
  return {
    dosyalar,
    putSayisi: () => putSayisi,
    async put(yol, buf) {
      putSayisi++;
      if (putHatasi?.(yol, putSayisi)) throw new Error("sahte ağ hatası");
      if (dosyalar.has(yol)) throw new Error("This blob already exists");
      dosyalar.set(yol, buf);
      return adres(yol);
    },
    async head(yol) {
      if (!dosyalar.has(yol)) throw new Error("not found");
      return adres(yol);
    },
  };
}

export const T = (ad) => `https://cdn.dsmcdn.com/ty1/${ad}.jpg`;

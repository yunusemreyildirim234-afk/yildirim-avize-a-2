// Kopyalama döngüsü: indir → işle → Blob'a iki sürümü yaz → manifeste kaydet. Bağımlılıklar dışarıdan verilir (testte sahte).
import { blobYolu, manifesteYaz, manifestKaydi, yazmaSay } from "./cekirdek.mjs";

/**
 * is: [{ productId, url }]. blob: { put(yol, buf) → url, head(yol) → url | null }. indir(url) → Buffer. isle(buf, [tuval]).
 * kaydet(): manifesti diske yazar (her yazma denemesinden ve her biten görselden sonra çağrılır; yarıda kesilirse kaldığı yerden sürer).
 * Aynı anda `es` görsel işlenir. Dönen: { tamam, hatalar: [{ productId, url, hata }] }.
 */
export async function kopyala({ is, manifest, tuval, blob, indir, isle, kaydet, es = 4, log = () => {} }) {
  const hatalar = [];
  let tamam = 0;
  let sira = 0;

  const yukle = async (yol, buf) => {
    yazmaSay(manifest);
    kaydet();
    try {
      return await blob.put(yol, buf);
    } catch (e) {
      // Belirlenimci yol: önceki koşuda yüklenmiş ama manifeste işlenmemiş olabilir (üzerine yazma kapalı)
      const mevcut = await blob.head(yol).catch(() => null);
      if (mevcut) return mevcut;
      throw e;
    }
  };

  const isci = async () => {
    while (sira < is.length) {
      const { productId, url } = is[sira++];
      if (manifestKaydi(manifest, productId, url, tuval)) continue;
      try {
        const sonuc = await isle(await indir(url), [tuval]);
        const c = sonuc.ciktilar[tuval];
        const b = await yukle(blobYolu(productId, url, tuval, "b"), c.b);
        const k = await yukle(blobYolu(productId, url, tuval, "k"), c.k);
        manifesteYaz(manifest, productId, url, tuval, { b, k, w: c.w, h: c.h, baytB: c.b.length, baytK: c.k.length, durum: sonuc.durum });
        kaydet();
        tamam++;
        if (tamam % 25 === 0) log(`${tamam} / ${is.length} görsel kopyalandı...`);
      } catch (e) {
        hatalar.push({ productId, url, hata: e instanceof Error ? e.message : String(e) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(es, is.length)) }, isci));
  return { tamam, hatalar };
}

// Gerçek Vercel Blob istemcisi ve indirme. Token yalnızca ortamdan okunur, hiçbir yere yazdırılmaz.
import { head, put } from "@vercel/blob";

const YIL = 365 * 24 * 60 * 60;

export function blobIstemcisi() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN tanımlı değil (kök .env.local ya da tools/gorsel/.env).");
  return {
    /** Herkese açık, rastgele soneksiz, üzerine yazma KAPALI, 1 yıl önbellek. */
    async put(yol, buf) {
      const r = await put(yol, buf, { access: "public", addRandomSuffix: false, allowOverwrite: false, contentType: "image/webp", cacheControlMaxAge: YIL, token });
      return r.url;
    },
    async head(yol) {
      return (await head(yol, { token })).url;
    },
  };
}

/** Kaynak görseli indirir: 30 sn zaman aşımı, 3 deneme, yalnızca görsel içerik, en çok 25 MB. */
export async function indir(url) {
  let son;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const tur = res.headers.get("content-type") ?? "";
      if (!tur.startsWith("image/")) throw new Error(`görsel değil (${tur || "tür yok"})`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > 25 * 1024 * 1024) throw new Error(`boyut uygun değil (${buf.length} bayt)`);
      return buf;
    } catch (e) {
      son = e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error(`indirilemedi: ${son instanceof Error ? son.message : String(son)}`);
}

/** Yazmadan sonra: her ürünün yeni kapağı gerçekten yayında mı (HEAD 200 + görsel türü)? Değilse hata. */
export async function kapaklariDogrula(planlar) {
  for (const p of planlar) {
    const url = p.yeni.imageUrl ?? p.yeni.images[0];
    if (!url) continue;
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(20000) });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) throw new Error(`Yeni görsel açılmıyor (HTTP ${res.status}): ürün ${p.id}. Durduruldu; gerekirse geri-al çalıştırın.`);
  }
}

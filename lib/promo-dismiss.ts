// "Avantajlar" kartı gizleme kararı: saf fonksiyonlar (depolama/DOM yok).
// Kayıt: { surum, gizlenmeZamani }. Kart; kayıt yoksa/bozuksa, sürüm farklıysa veya 24 saat geçtiyse tekrar gösterilir.

export const AVANTAJ_KAYIT_ANAHTARI = "ya-avantaj-gizle";
export const AVANTAJ_ACMA_OLAYI = "ya-avantaj-ac";
export const AVANTAJ_DEGISTI_OLAYI = "ya-avantaj-degisti";
export const GIZLEME_SURESI_MS = 24 * 60 * 60 * 1000;

export interface AvantajKaydi {
  surum: string;
  gizlenmeZamani: number;
}

/** Ham depolama metnini doğrular; bozuk/eksik ise null. */
export function kaydiCoz(ham: string | null | undefined): AvantajKaydi | null {
  if (!ham) return null;
  try {
    const o: unknown = JSON.parse(ham);
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const r = o as Record<string, unknown>;
    if (typeof r.surum !== "string" || typeof r.gizlenmeZamani !== "number" || !Number.isFinite(r.gizlenmeZamani)) return null;
    return { surum: r.surum, gizlenmeZamani: r.gizlenmeZamani };
  } catch {
    return null;
  }
}

/** Gizli kalması için: kayıt var + sürüm güncel + 24 saat dolmamış (saat geri alınmışsa da gösterilir). */
export function avantajGorunsunMu({ kayit, guncelSurum, simdi }: { kayit: AvantajKaydi | null | undefined; guncelSurum: string; simdi: number }): boolean {
  if (!kayit) return true;
  if (kayit.surum !== guncelSurum) return true;
  const gecen = simdi - kayit.gizlenmeZamani;
  return !(gecen >= 0 && gecen < GIZLEME_SURESI_MS);
}

/**
 * Kart içeriğinden sürüm: kart kimliği, kupon kodu, başlık ve metin (oranlar/eşikler metne işlenmiş gelir).
 * İçerik değişince değişir; basit 32 bit FNV-1a özeti.
 */
export function avantajSurumu(kartlar: { id: string; code?: string; title: string; text: string }[]): string {
  const s = kartlar.map((k) => `${k.id}\u0001${k.code ?? ""}\u0001${k.title}\u0001${k.text}`).join("\u0002");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

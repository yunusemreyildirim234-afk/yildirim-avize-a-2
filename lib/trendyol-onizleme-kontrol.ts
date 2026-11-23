// "Uygula" isteğindeki önizleme sayaçları (sayac) ile sunucuda yeniden hesaplanan plan karşılaştırılır.
// Yalnız RİSKLİ alanlar artmışsa önizleme eskimiş sayılır; azalma güvenlidir (onaylanandan fazlası uygulanmaz).
// sayac gönderilmezse (eski istemci) karşılaştırma yapılmaz: geriye uyumlu.
export const ESKI_ONIZLEME_MESAJI = "Önizleme eskidi, yeniden önizleyin.";
const RISKLI = ["pasifeAlinacak", "ezilecek", "yeniUrun"] as const;

export function onizlemeEskidiMi(gonderilen: unknown, guncel: Partial<Record<(typeof RISKLI)[number], number>>): boolean {
  if (!gonderilen || typeof gonderilen !== "object" || Array.isArray(gonderilen)) return false;
  const g = gonderilen as Record<string, unknown>;
  return RISKLI.some((k) => {
    const eski = g[k];
    const yeni = guncel[k];
    return typeof eski === "number" && Number.isFinite(eski) && typeof yeni === "number" && yeni > eski;
  });
}

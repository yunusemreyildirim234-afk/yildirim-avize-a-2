/** Kargo firmasına göre takip bağlantısı (saf fonksiyon). Hepsijet için derin bağlantı biçimi doğrulanmadığı için ana sayfaya gider. */
export const HEPSIJET_HINT = "Gönderi numaranızı açılan sayfaya yapıştırın";
/** queryLabel: müşteri tarafı kısa bağlantı metni; hint: varsa bağlantının altına yazılacak ipucu. */
export type CarrierTracking = { label: string; href: string | null; code: string; queryLabel: string; hint: string | null };

export function carrierTrackingLink(p: {
  providerId?: number | null;
  providerName?: string | null;
  code?: string | null;
}): CarrierTracking {
  const code = (p.code ?? "").trim();
  const name = (p.providerName ?? "").toLocaleLowerCase("tr");
  if (p.providerId === 4 || name.includes("aras")) {
    return {
      label: "Aras Kargo ile Canlı Takip Et ↗",
      href: code ? `https://kargotakip.araskargo.com.tr/?kargotakipno=${encodeURIComponent(code)}` : null,
      code,
      queryLabel: "Aras Kargo ile Canlı Takip Et ↗",
      hint: null,
    };
  }
  if (p.providerId === 6 || name.includes("hepsijet")) {
    return { label: "Hepsijet'te Takip Et ↗", href: "https://www.hepsijet.com/", code, queryLabel: "Hepsijet'te sorgula ↗", hint: HEPSIJET_HINT };
  }
  return { label: "Kargo", href: null, code, queryLabel: "Kargo", hint: null };
}

/** Firma adı yoksa nötr "Kargo". */
export function carrierDisplayName(name?: string | null): string {
  return name?.trim() || "Kargo";
}

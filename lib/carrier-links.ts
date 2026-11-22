/** Kargo firmasına göre takip bağlantısı (saf fonksiyon). Hepsijet ve Aras için derin bağlantı biçimi doğrulanmadığı için ana sayfaya gider (Aras eski takip adresini kapattı). */
export const HEPSIJET_HINT = "Gönderi numaranızı açılan sayfaya yapıştırın";
export const ARAS_HINT = "Takip numaranızı açılan sayfaya yapıştırın";
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
      label: "Aras Kargo'da sorgula ↗",
      href: code ? "https://www.araskargo.com.tr/" : null,
      code,
      queryLabel: "Aras Kargo'da sorgula ↗",
      hint: ARAS_HINT,
    };
  }
  if (p.providerId === 6 || name.includes("hepsijet")) {
    return { label: "Hepsijet'te Takip Et ↗", href: "https://www.hepsijet.com/", code, queryLabel: "Hepsijet'te sorgula ↗", hint: HEPSIJET_HINT };
  }
  return { label: "Kargo", href: null, code, queryLabel: "Kargo", hint: null };
}

/** "…'ya/'e teslim edildi" tamlaması: Aras → "Aras Kargo'ya", Hepsijet → "Hepsijet'e", diğer/bilinmeyen → "kargo firmasına". */
export function carrierDativeName(name?: string | null): string {
  const n = (name ?? "").toLocaleLowerCase("tr");
  if (n.includes("aras")) return "Aras Kargo'ya";
  if (n.includes("hepsijet")) return "Hepsijet'e";
  return "kargo firmasına";
}

/** Firma adı yoksa nötr "Kargo". */
export function carrierDisplayName(name?: string | null): string {
  return name?.trim() || "Kargo";
}

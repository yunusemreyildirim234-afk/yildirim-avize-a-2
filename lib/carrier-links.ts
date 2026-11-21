/** Kargo firmasına göre takip bağlantısı (saf fonksiyon). Hepsijet için derin bağlantı biçimi doğrulanmadığı için ana sayfaya gider. */
export type CarrierTracking = { label: string; href: string | null; code: string };

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
    };
  }
  if (p.providerId === 6 || name.includes("hepsijet")) {
    return { label: "Hepsijet'te Takip Et ↗", href: "https://www.hepsijet.com/", code };
  }
  return { label: "Kargo", href: null, code };
}

/** Firma adı yoksa nötr "Kargo". */
export function carrierDisplayName(name?: string | null): string {
  return name?.trim() || "Kargo";
}

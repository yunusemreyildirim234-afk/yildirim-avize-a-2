/** Şifre kuralları: istemcide canlı gösterge, sunucuda zorunlu doğrulama için ortak. */
export const PASSWORD_RULES = [
  { key: "len", label: "En az 8 karakter", test: (p: string) => p.length >= 8 },
  { key: "upper", label: "En az 1 büyük harf (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower", label: "En az 1 küçük harf (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { key: "digit", label: "En az 1 rakam (0-9)", test: (p: string) => /[0-9]/.test(p) },
  { key: "special", label: "En az 1 özel karakter (!@#$...)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export const isStrongPassword = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Fatura bilgilerini doğrular; hata varsa Türkçe mesaj döner. */
export function invoiceError(i: { invoiceType?: string; taxNumber?: string; taxOffice?: string; companyTitle?: string }): string | null {
  const tax = (i.taxNumber ?? "").replace(/\s/g, "");
  if (i.invoiceType === "CORPORATE") {
    if (!(i.companyTitle ?? "").trim()) return "Kurumsal fatura için şirket unvanı zorunludur.";
    if (!(i.taxOffice ?? "").trim()) return "Kurumsal fatura için vergi dairesi zorunludur.";
    if (!/^\d{10}$/.test(tax)) return "Vergi Kimlik Numarası (VKN) 10 haneli olmalıdır.";
    return null;
  }
  if (tax && !/^\d{11}$/.test(tax)) return "T.C. Kimlik Numarası 11 haneli olmalıdır.";
  return null;
}

/** Görünen ad doğrulaması (üye profili ve admin düzenlemesi ortak): kontrol karakterleri temizlenir, boşluklar sadeleşir, 2-60 karakter. */
export function cleanDisplayName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof raw === "string" ? raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").replace(/\s+/g, " ").trim() : "";
  if (name.length < 2) return { ok: false, error: "Ad en az 2 karakter olmalıdır." };
  if (name.length > 60) return { ok: false, error: "Ad en fazla 60 karakter olabilir." };
  if (/[<>]/.test(name)) return { ok: false, error: "Ad geçersiz karakter içeriyor." };
  return { ok: true, name };
}

// Üretimde zorunlu ortam değişkenlerinin ADLARINI denetler. DEĞER okunup yazdırılmaz; yalnızca varlık/boşluk bakılır.
// Eksik olan uygulamayı çökertmez: yalnızca loglanır (Vercel loglarında ilk açılışta görünür).

export const REQUIRED_PRODUCTION_ENV = [
  "NEXTAUTH_SECRET",
  "DATABASE_URL",
  "PAYTR_MERCHANT_ID",
  "PAYTR_MERCHANT_KEY",
  "PAYTR_MERCHANT_SALT",
  "KARGONOMI_API_KEY",
  "KARGONOMI_API_TOKEN",
  "KARGONOMI_WEBHOOK_SECRET",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "BLOB_READ_WRITE_TOKEN",
] as const;

/** Eksik (tanımsız ya da yalnız boşluk) değişken adları. */
export function missingEnv(env: Record<string, string | undefined>, names: readonly string[] = REQUIRED_PRODUCTION_ENV): string[] {
  return names.filter((n) => !env[n]?.trim());
}

/** Yalnızca VERCEL_ENV === "production" iken denetler; eksik adları console.error ile yazar, hiçbir şey fırlatmaz. Eksik adları döner. */
export function checkProductionEnv(env: Record<string, string | undefined> = process.env, log: (...a: unknown[]) => void = console.error): string[] {
  if (env.VERCEL_ENV !== "production") return [];
  const missing = missingEnv(env);
  if (missing.length > 0) log(`[env-check] Eksik ortam değişkenleri (${missing.length}): ${missing.join(", ")}`);
  return missing;
}

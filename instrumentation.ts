// Sunucu başlarken bir kez çalışır: üretimde eksik ortam değişkeni adlarını loglar (çökertmez, değer yazdırmaz).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkProductionEnv } = await import("./lib/env-check");
  checkProductionEnv();
}

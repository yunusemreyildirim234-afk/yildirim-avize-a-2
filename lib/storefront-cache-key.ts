// Vitrin veri önbelleği için saf anahtar/etiket yardımcıları (kişiye özel girdi kabul etmez; test edilebilir).

type Where = Record<string, unknown> | undefined;

/** Parametreler (where/take/skip) farklıysa anahtar farklıdır; yalnızca JSON'a çevrilebilir sorgu parametrelerinden üretilir. */
export const productsCacheKey = (where: Where, take?: number, skip?: number) => JSON.stringify([where ?? {}, take ?? null, skip ?? null]);

/** where içinde düz bir kategori eşitliği varsa kategoriye özel etiket ("category:<ad>"). */
export function categoryTagOf(where: Where): string | null {
  const c = where?.category;
  return typeof c === "string" && c ? `category:${c}` : null;
}

/** Her önbellek girdisinin etiketleri: genel "storefront" (revalidateStorefront bunu geçersiz kılar) + varsa kategoriye özel. */
export const storefrontTags = (where: Where): string[] => ["storefront", ...(categoryTagOf(where) ? [categoryTagOf(where)!] : [])];

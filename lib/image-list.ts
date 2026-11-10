// Görsel listesi için SAF yardımcılar (içe aktarma yok; istemci ve testte kullanılır).

/** "Değiştir": listedeki index'teki öğenin yerine yenisini koyar; sıra ve diğer öğeler aynen kalır. Geçersiz index'te liste değişmez. */
export function replaceAt<T>(list: readonly T[], index: number, next: T): T[] {
  return list.map((it, i) => (i === index ? next : it));
}

/** İndirilen dosya adı gövdesi: "<ürün adı>-<sıra>" (sıra 1'den; adı yoksa "urun"). */
export function downloadBaseName(productTitle: string, index: number): string {
  const slug = productTitle.trim().toLocaleLowerCase("tr").replace(/[^a-z0-9ığüşöç]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "urun"}-${index + 1}`;
}

/**
 * "Genel galeriden seç": seçilen adreslerden, listede zaten olmayanları seçim sırasıyla döndürür
 * (tekrarsız; mevcut listeyle birlikte en çok `max` öğe olacak kadar). Mevcut öğelere dokunmaz, yalnızca sona eklenecekleri verir.
 */
export function urlsToAppend(existing: readonly string[], picked: readonly string[], max: number): string[] {
  const seen = new Set(existing);
  const out: string[] = [];
  for (const u of picked) {
    if (existing.length + out.length >= max) break;
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

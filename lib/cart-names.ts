// Misafir sepetinde localStorage'daki varyasyon adı kopyasını sunucudaki güncel adla eşitleyen saf yardımcılar.
// Ürün sayfası adı "Seçenek: Bej" (tür önekli), hızlı ekleme "Bej" (öneksiz) olarak kaydeder; güncellerken kayıtlı önek biçimi korunur.
const PREFIX_RE = /^[^:]+:\s*/;

/** Kayıtlı ad güncel adla aynıysa (öneksiz ya da önekli) aynen döner; değilse kayıtlı önek korunarak güncel ad yazılır. */
export function refreshedName(stored: string, serverName: string): string {
  const name = serverName.trim();
  if (!name || stored === name) return stored;
  const prefix = PREFIX_RE.exec(stored)?.[0] ?? "";
  if (prefix && stored.slice(prefix.length) === name) return stored;
  return `${prefix}${name}`;
}

/** Ad değişmediyse AYNI dizi referansı döner (gereksiz render ve localStorage yazımı olmaz). */
export function applyNameUpdates<T extends { variationId: string; variationName: string }>(cart: T[], updates: { variationId: string; variationName: string }[]): T[] {
  const map = new Map(updates.map((u) => [u.variationId, u.variationName]));
  let changed = false;
  const next = cart.map((i) => {
    const server = map.get(i.variationId);
    if (server === undefined) return i;
    const name = refreshedName(i.variationName, server);
    if (name === i.variationName) return i;
    changed = true;
    return { ...i, variationName: name };
  });
  return changed ? next : cart;
}

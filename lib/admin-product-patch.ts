// Ürün listesi yerel yaması (CMP-02): sunucudan BAŞARIYLA dönen değer yerele yazılır (iyimser tahmin değil).
// Yama `base` (sunucu prop'u) kimliğine bağlıdır: sunucudan yeni liste gelince (referans değişince) yama yok sayılır, sunucu verisi kazanır.

export interface PatchableProduct {
  id: string;
  active?: boolean;
  variations: { id: string; stock: number }[];
}

export interface ProductPatch<P extends PatchableProduct> {
  base: P[];
  stock: Record<string, number>; // varyasyon kimliği → sunucunun yazdığı stok
  active: Record<string, boolean>; // ürün kimliği → sunucunun yazdığı aktiflik
  hidden: Record<string, boolean>; // ürün kimliği → sunucunun yazdığı "stoksuzken gizle" istisnası
}

export const emptyPatch = <P extends PatchableProduct>(base: P[]): ProductPatch<P> => ({ base, stock: {}, active: {}, hidden: {} });

/** Yama hâlâ bu sunucu listesine mi ait? Değilse boş döner. */
export function currentPatch<P extends PatchableProduct>(patch: ProductPatch<P>, base: P[]): ProductPatch<P> {
  return patch.base === base ? patch : emptyPatch(base);
}

type PatchKey = "stock" | "active" | "hidden";

/** Sunucu değerini yamaya yazar; eski sunucu listesine ait yama önce atılır. */
export function withPatched<P extends PatchableProduct, K extends PatchKey>(
  patch: ProductPatch<P>,
  base: P[],
  key: K,
  id: string,
  value: ProductPatch<P>[K][string]
): ProductPatch<P> {
  const cur = currentPatch(patch, base);
  return { ...cur, [key]: { ...cur[key], [id]: value } };
}

/** Sunucu listesine yamayı uygular; yama yoksa AYNI diziyi döner (gereksiz yeniden hesap olmaz). */
export function applyPatch<P extends PatchableProduct>(base: P[], patch: ProductPatch<P>): P[] {
  const cur = currentPatch(patch, base);
  const hasStock = Object.keys(cur.stock).length > 0;
  const hasActive = Object.keys(cur.active).length > 0;
  if (!hasStock && !hasActive) return base;
  return base.map((p) => {
    const active = p.id in cur.active ? cur.active[p.id] : p.active;
    const touched = active !== p.active || p.variations.some((v) => v.id in cur.stock);
    if (!touched) return p;
    return { ...p, active, variations: p.variations.map((v) => (v.id in cur.stock ? { ...v, stock: cur.stock[v.id] } : v)) };
  });
}

/** "Stoksuzken gizle" kimlik listesine yamayı uygular. */
export function applyHiddenIds<P extends PatchableProduct>(hiddenIds: string[], base: P[], patch: ProductPatch<P>): string[] {
  const cur = currentPatch(patch, base);
  const ids = Object.keys(cur.hidden);
  if (ids.length === 0) return hiddenIds;
  const set = new Set(hiddenIds);
  for (const id of ids) {
    if (cur.hidden[id]) set.add(id);
    else set.delete(id);
  }
  return [...set];
}

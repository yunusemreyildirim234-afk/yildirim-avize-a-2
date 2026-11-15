import { slugifyTr } from "./categories.ts";
import { displayTitle } from "./title-display.ts";

/** Ürün adresi: /urun/{ad-slug}-{kimliğin ilk 8 hex'i}. Çözümleme yalnız sondaki kısa kimliğe bakar; ad kısmı süstür (eski/yanlış ad 308 ile düzelir). */
export const SHORT_ID_LEN = 8;
const SLUG_MAX = 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHORT_RE = /^(?:.*-)?([0-9a-f]{8})$/;

/** Başlıktan adres parçası: Türkçe karakterler çevrilir, en çok 60 karakter, simge-yalnız başlık "urun" olur. */
export function productSlug(title: string): string {
  const clean = displayTitle(title).title.trim();
  if (!clean) return "";
  let slug = slugifyTr(clean);
  if (slug === "kategori" && !/kategori/i.test(clean)) slug = "urun"; // slugifyTr boş sonuçta "kategori" döner
  return slug.slice(0, SLUG_MAX).replace(/-+$/g, "");
}

/** Kanonik ürün yolu. Başlık yoksa eski uuid adresine düşer (o adres sayfada 308 ile düzelir). */
export function productPath(p: { id: string; title?: string | null }): string {
  const slug = productSlug(p.title ?? "");
  return slug ? `/urun/${slug}-${p.id.slice(0, SHORT_ID_LEN)}` : `/urun/${p.id}`;
}

export type ProductParam = { kind: "legacy-uuid"; id: string } | { kind: "short"; short: string } | { kind: "bad" };

/** Adres parametresini çözer. Tam uuid → eski adres; sonda 8 hex → kısa kimlik; diğer her şey (javascript: vb. dahil) → bad. */
export function parseProductParam(param: string): ProductParam {
  let s: string;
  try {
    s = decodeURIComponent(param).trim().toLowerCase();
  } catch {
    return { kind: "bad" };
  }
  if (!s || s.length > 200) return { kind: "bad" };
  if (UUID_RE.test(s)) return { kind: "legacy-uuid", id: s };
  if (!/^[a-z0-9-]+$/.test(s)) return { kind: "bad" };
  const m = SHORT_RE.exec(s);
  return m ? { kind: "short", short: m[1] } : { kind: "bad" };
}

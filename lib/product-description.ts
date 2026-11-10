// Ürün açıklamasının yönetici tarafından düzenlenmesi (M15) için saf kurallar: girdi temizliği, Trendyol metninin anlık görüntüden okunması, eşitleme uyarısı.

export const MAX_DESCRIPTION = 10_000;
export const DESCRIPTION_OVERWRITE_WARNING = "Bu modda yazdığınız açıklama Trendyol eşitlemesinde üzerine yazılır.";

export type DescriptionResult = { ok: true; value: string | null } | { ok: false; error: string };

// Satır başı (\n) ve sekme (\t) dışındaki denetim karakterleri + görünmez biçim karakterleri (sıfır genişlikli boşluk, satır/paragraf ayırıcı, BOM)
const STRIP = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u200B\\u2028\\u2029\\uFEFF]", "g");

/**
 * Açıklama girdisi: metin ya da null (boşalt). Satır sonları \n'e çevrilir, denetim karakterleri atılır, baş/son boşluk kırpılır; boş metin null olur.
 * Sınırı aşan metin sessizce kesilmez, reddedilir. Metin vitrinde düz yazı olarak basılır (HTML işlenmez), bu yüzden etiketler ayıklanmaz.
 */
export function normalizeDescription(input: unknown): DescriptionResult {
  if (input === null) return { ok: true, value: null };
  if (typeof input !== "string") return { ok: false, error: "Geçersiz açıklama." };
  const text = input.replace(/\r\n?/g, "\n").replace(STRIP, "").trim();
  if (text.length > MAX_DESCRIPTION) return { ok: false, error: `Açıklama en fazla ${MAX_DESCRIPTION.toLocaleString("tr-TR")} karakter olabilir.` };
  return { ok: true, value: text || null };
}

/** Trendyol'un son eşitlemede gönderdiği açıklama (Product.syncSnapshot.description). Kayıt yoksa ya da metin değilse null. */
export function snapshotDescription(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const d = (snapshot as Record<string, unknown>).description;
  return typeof d === "string" && d.trim() ? d : null;
}

/** Eşitlemede "Başlık ve açıklama" (TEXT) grubu "Ezerek" mi? Öyleyse elle yazılan açıklama sonraki eşitlemede kaybolur. */
export function isTextOverwrite(modes: { TEXT?: unknown } | null | undefined): boolean {
  return modes?.TEXT === "OVERWRITE";
}

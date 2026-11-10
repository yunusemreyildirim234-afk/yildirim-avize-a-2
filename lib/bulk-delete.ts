// "Listelenen / Filtrelenen N siparişi sil" güvenliği: onay metni, yazılı onay ve sunucu tarafı sayı denetimi (saf kurallar).
import { ORDER_GROUPS, parseGroupParam } from "./orderStatus.ts";
import { DATE_PRESET_LABELS, type DatePreset } from "./admin-order-search.ts";

export const DELETE_CONFIRM_WORD = "SİL";

/** Yazılan onay: büyük/küçük harf ve Türkçe i/ı farkı gözetilmez ("sil", "SIL", "SİL" kabul); başka her şey reddedilir. */
export function isDeleteConfirmed(input: string | null | undefined): boolean {
  const t = (input ?? "").trim().toLocaleUpperCase("tr-TR");
  return t === "SİL" || t === "SIL";
}

export interface ActiveFilters {
  durum?: string;
  q?: string;
  tarih?: string;
  bas?: string;
  bit?: string;
  /** tarih aralığı gerçekten uygulandı mı (geçersiz tarih süzmez) */
  dateActive: boolean;
}

/** Arama veya tarih süzgeci açık mı? (Etiket "Filtrelenen" olur.) */
export const isFiltered = (f: Pick<ActiveFilters, "q" | "dateActive">): boolean => Boolean(f.q?.trim()) || f.dateActive;

export function deleteButtonLabel(count: number, f: Pick<ActiveFilters, "q" | "dateActive">): string {
  return `${isFiltered(f) ? "Filtrelenen" : "Listelenen"} ${count} siparişi sil`;
}

/** Aktif süzgeçlerin düz yazı dökümü: durum grupları, arama metni, tarih aralığı. */
export function describeFilters(f: ActiveFilters): string {
  const keys = parseGroupParam(f.durum);
  const durum = keys.length >= ORDER_GROUPS.length ? "Tümü" : ORDER_GROUPS.filter((g) => keys.includes(g.key)).map((g) => g.label).join(", ");
  const parts = [`Durum: ${durum}`, `Arama: ${f.q?.trim() ? `"${f.q.trim()}"` : "yok"}`];
  let tarih = "tüm zamanlar";
  if (f.dateActive && f.tarih) {
    tarih = DATE_PRESET_LABELS[f.tarih as DatePreset] ?? f.tarih;
    if (f.tarih === "ozel") tarih += ` (${f.bas || "…"} – ${f.bit || "…"})`;
  }
  parts.push(`Tarih: ${tarih}`);
  return parts.join(" • ");
}

export function deleteConfirmText(count: number, f: ActiveFilters): string {
  return `${count} sipariş ve bağlı fatura/dekont kayıtları silinecek; ayrılmış stok iade edilir.\nAktif süzgeçler → ${describeFilters(f)}`;
}

/**
 * Sunucu denetimi: istemcinin onayladığı sayı ile bu istekteki benzersiz kimlik sayısı ve veritabanında bulunan sipariş sayısı aynı olmalı.
 * Liste bu arada değiştiyse (sipariş silindi/yok) ya da sayı gönderilmediyse çoklu silme reddedilir. Tek sipariş silmede sayı istenmez.
 */
export function checkDeleteCount(p: { requested: number; expected: unknown; found: number }): string | null {
  const bulk = p.requested > 1;
  if (p.expected === undefined || p.expected === null) return bulk ? "Onaylanan sipariş sayısı gönderilmedi; sayfayı yenileyip tekrar deneyin. Hiçbir sipariş silinmedi." : null;
  if (!Number.isInteger(p.expected) || p.expected !== p.requested || p.found !== p.requested) {
    return `Liste değişmiş: onaylanan ${String(p.expected)}, istenen ${p.requested}, kayıtlı ${p.found} sipariş. Sayfayı yenileyip tekrar deneyin. Hiçbir sipariş silinmedi.`;
  }
  return null;
}

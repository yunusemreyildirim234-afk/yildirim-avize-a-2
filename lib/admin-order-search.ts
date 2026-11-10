// Yönetim paneli sipariş listesi: arama ve tarih aralığı (saf kurallar; veritabanı yok). Durum çipleriyle kesişim olarak çalışır.
import { normalizeSearch } from "./search-rank.ts";
import { cleanGuestEmail } from "./guest-email.ts";

export const MAX_ORDER_QUERY = 100;

export interface SearchableOrder {
  id: string;
  phone?: string | null;
  user: { name: string; email: string };
}

const digits = (s: string) => s.replace(/\D/g, "");
/** Telefon karşılaştırması: +90 / 0 öneki atılır, geriye ulusal numara kalır. */
const national = (d: string) => (d.startsWith("90") && d.length >= 12 ? d.slice(2) : d.replace(/^0+/, ""));

/**
 * Sipariş kodu (8 hane) ya da tam kimlik, müşteri adı, e-posta (misafir etiketi temizlenmiş) ve telefon. Türkçe büyük/küçük harf ve aksan duyarsızdır
 * (normalizeSearch); ad/e-postada sorgunun tüm sözcükleri bulunmalı. Boş sorgu her siparişle eşleşir.
 */
export function matchesOrderSearch(o: SearchableOrder, query: string): boolean {
  const raw = query.trim().slice(0, MAX_ORDER_QUERY);
  if (!raw) return true;
  const lower = raw.toLowerCase();
  if (/^[0-9a-f-]{3,}$/.test(lower) && o.id.toLowerCase().includes(lower)) return true;
  const tokens = normalizeSearch(raw).split(" ").filter(Boolean);
  if (tokens.length > 0) {
    const text = normalizeSearch(`${o.user.name} ${cleanGuestEmail(o.user.email)}`);
    if (tokens.every((t) => text.includes(t))) return true;
  }
  const q = national(digits(raw));
  if (q.length >= 3 && /^[\d\s+()-]+$/.test(raw) && o.phone) return national(digits(o.phone)).includes(q);
  return false;
}

// ---- Tarih aralığı (İstanbul günü; Türkiye'de yaz saati yok, sabit UTC+3) ----

export const DATE_PRESETS = ["bugun", "son7", "ay", "ozel"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];
export const DATE_PRESET_LABELS: Record<DatePreset, string> = { bugun: "Bugün", son7: "Son 7 gün", ay: "Bu ay", ozel: "Özel aralık" };

const TZ_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;

/** İstanbul'daki takvim gününün başlangıcı (UTC anı). */
function istanbulDayStart(ms: number): number {
  const d = new Date(ms + TZ_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - TZ_MS;
}

/** "YYYY-MM-DD" gerçek bir tarihse İstanbul gün başlangıcı, değilse null (2026-02-31 geçersiz). */
export function parseDay(s: string | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return t.getTime() - TZ_MS;
}

export interface DateRange {
  /** dahil */
  start: number;
  /** hariç */
  end: number;
}

/** Ön ayar ya da özel aralıktan [başlangıç, bitiş) üretir; geçersiz/eksik girdide null (süzme yok). Özel aralıkta başlangıç > bitiş ise yer değiştirir; bitiş günü dahildir. */
export function resolveDateRange(preset: string | undefined, from: string | undefined, to: string | undefined, now: Date): DateRange | null {
  const today = istanbulDayStart(now.getTime());
  if (preset === "bugun") return { start: today, end: today + DAY_MS };
  if (preset === "son7") return { start: today - 6 * DAY_MS, end: today + DAY_MS };
  if (preset === "ay") {
    const d = new Date(now.getTime() + TZ_MS);
    return { start: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - TZ_MS, end: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - TZ_MS };
  }
  if (preset === "ozel") {
    const a = parseDay(from);
    const b = parseDay(to);
    if (a === null && b === null) return null;
    const lo = a !== null && b !== null ? Math.min(a, b) : (a ?? -Infinity);
    const hi = a !== null && b !== null ? Math.max(a, b) : (b ?? Infinity);
    return { start: lo, end: hi === Infinity ? Infinity : hi + DAY_MS };
  }
  return null;
}

export const inDateRange = (createdAt: Date, range: DateRange | null): boolean => !range || (createdAt.getTime() >= range.start && createdAt.getTime() < range.end);

export interface OrderFilterParams {
  durum?: string;
  q?: string;
  tarih?: string;
  bas?: string;
  bit?: string;
}

/** Süzgeç parametrelerinden temiz sorgu dizesi (boş alanlar atılır); çipler ve form aynı yapıyı kullanır. */
export function filterQuery(p: OrderFilterParams): string {
  const sp = new URLSearchParams();
  if (p.durum) sp.set("durum", p.durum);
  if (p.q?.trim()) sp.set("q", p.q.trim().slice(0, MAX_ORDER_QUERY));
  if (p.tarih && (DATE_PRESETS as readonly string[]).includes(p.tarih)) {
    sp.set("tarih", p.tarih);
    if (p.tarih === "ozel") {
      if (parseDay(p.bas) !== null) sp.set("bas", p.bas as string);
      if (parseDay(p.bit) !== null) sp.set("bit", p.bit as string);
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

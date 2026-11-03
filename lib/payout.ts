// Kuveyt Türk hesabı GÖSTERİMİ için saf hesaplar (veritabanı/ağ yok). Ödeme, stok veya fiyat mantığına dokunmaz.
// Kural: yalnızca kartlı (CREDIT_CARD) ve ödemesi alınmış siparişler; yatış = ödeme günü + 30 gün (Europe/Istanbul gün bazında);
// net = brüt − komisyon. Tutarlar KURUŞ (tam sayı) hesaplanır, böylece toplamlar kayan nokta hatası taşımaz.

export const PAYOUT_DAYS = 30;
export const COMMISSION_RATE = 0.0125;
export const PAYOUT_TZ = "Europe/Istanbul";
/** Ödemesi alınmamış / geri dönmüş durumlar: listeye ve toplama girmez. */
export const PAYOUT_EXCLUDED_STATUSES = ["AWAITING_PAYMENT", "PAYMENT_FAILED", "CANCELLED", "RETURNED"];
/** Sorgu penceresi: yatışı bekleyenler (≤30 gün) + yeni yatanlar. */
export const PAYOUT_WINDOW_DAYS = 35;

/** Sorgu penceresinin başlangıcı (şimdi − 35 gün). */
export const payoutWindowStart = (now: Date = new Date()) => new Date(now.getTime() - PAYOUT_WINDOW_DAYS * 24 * 3600_000);

export interface PayoutOrder {
  id: string;
  createdAt: Date | string; // ödeme zamanı alanı şemada yok; sipariş oluşturma zamanı kullanılır
  totalAmount: number; // müşterinin ödediği toplam (kargo dahil)
  paymentMethod: string | null;
  status: string;
}

export interface PayoutRow {
  id: string;
  orderDay: string; // YYYY-MM-DD (İstanbul)
  payoutDay: string; // YYYY-MM-DD
  grossKurus: number;
  commissionKurus: number;
  netKurus: number;
}
export interface PayoutGroup { day: string; netKurus: number; rows: PayoutRow[] }
export interface PayoutSummary {
  pendingKurus: number; // henüz yatmamış net toplam
  pending: PayoutGroup[]; // yatış günü bugün ve sonrası; yakın tarih üstte
  paid: PayoutGroup[]; // bugünden önce (tahmini yattı); en yeni üstte; toplama katılmaz
}

/** Anın İstanbul takvim günü: "YYYY-MM-DD". */
export function istanbulDay(d: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PAYOUT_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
}

/** Takvim gününe gün ekler (ay/yıl sonu dahil); saat dilimi kayması yok (UTC öğlen üzerinden). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}

/** "5 Aralık" */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" });
}

/** "26 Kasım 2026" */
export function dayLabelLong(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Tek sipariş: brüt kuruşa yuvarlanır, komisyon kuruşa yuvarlanır, net = brüt − komisyon (toplamlar tutarlı). */
export function payoutOf(totalAmount: number, createdAt: Date | string) {
  const grossKurus = Math.round(totalAmount * 100);
  const commissionKurus = Math.round(grossKurus * COMMISSION_RATE);
  const orderDay = istanbulDay(createdAt);
  return { grossKurus, commissionKurus, netKurus: grossKurus - commissionKurus, orderDay, payoutDay: addDays(orderDay, PAYOUT_DAYS) };
}

export const isPayoutOrder = (o: Pick<PayoutOrder, "paymentMethod" | "status">) => o.paymentMethod === "CREDIT_CARD" && !PAYOUT_EXCLUDED_STATUSES.includes(o.status);

function group(rows: PayoutRow[]): PayoutGroup[] {
  const map = new Map<string, PayoutRow[]>();
  for (const r of rows) map.set(r.payoutDay, [...(map.get(r.payoutDay) ?? []), r]);
  return [...map].map(([day, rs]) => ({ day, netKurus: rs.reduce((s, r) => s + r.netKurus, 0), rows: rs }));
}

/** Siparişleri yatış gününe göre gruplar. Yatış günü bugünden ÖNCEyse "yattı", değilse "bekleyen" (yalnızca bekleyen toplanır). */
export function buildPayouts(orders: PayoutOrder[], now: Date = new Date()): PayoutSummary {
  const today = istanbulDay(now);
  const rows: PayoutRow[] = orders
    .filter(isPayoutOrder)
    .map((o) => ({ id: o.id, ...payoutOf(o.totalAmount, o.createdAt) }))
    .sort((a, b) => (a.orderDay < b.orderDay ? -1 : a.orderDay > b.orderDay ? 1 : 0));
  const pending = group(rows.filter((r) => r.payoutDay >= today)).sort((a, b) => (a.day < b.day ? -1 : 1));
  const paid = group(rows.filter((r) => r.payoutDay < today)).sort((a, b) => (a.day < b.day ? 1 : -1));
  return { pendingKurus: pending.reduce((s, g) => s + g.netKurus, 0), pending, paid };
}

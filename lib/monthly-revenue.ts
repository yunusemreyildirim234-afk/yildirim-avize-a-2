/** Aylık ciro (saf fonksiyon). Ay, createdAt'in Europe/Istanbul takvimine göredir. Tutarlar kuruş tamsayısı olarak toplanır. */
export const MONTH_NAMES_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export type MonthRow = { key: string; label: string; orderCount: number; revenue: number };
export type MonthlyRevenue = { months: MonthRow[]; total: number; currentKey: string; currentLabel: string; currentRevenue: number };

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit" });

/** [yıl, ay(1-12)] — İstanbul takvimine göre. */
function ym(d: Date): [number, number] {
  const parts = fmt.formatToParts(d);
  return [Number(parts.find((p) => p.type === "year")?.value), Number(parts.find((p) => p.type === "month")?.value)];
}
const keyOf = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const labelOf = (y: number, m: number) => `${MONTH_NAMES_TR[m - 1]} ${y}`;

export function monthlyRevenue(orders: { createdAt: Date; totalAmount: number }[], now: Date): MonthlyRevenue {
  const [ny, nm] = ym(now);
  const agg = new Map<string, { n: number; kurus: number }>();
  let first = ny * 12 + (nm - 1);
  let last = first;
  let totalKurus = 0;
  for (const o of orders) {
    const [y, m] = ym(o.createdAt);
    const idx = y * 12 + (m - 1);
    if (idx < first) first = idx;
    if (idx > last) last = idx;
    const k = keyOf(y, m);
    const a = agg.get(k) ?? { n: 0, kurus: 0 };
    const kurus = Math.round(o.totalAmount * 100);
    a.n += 1;
    a.kurus += kurus;
    totalKurus += kurus;
    agg.set(k, a);
  }
  const months: MonthRow[] = [];
  for (let idx = last; idx >= first; idx--) {
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const a = agg.get(keyOf(y, m));
    months.push({ key: keyOf(y, m), label: labelOf(y, m), orderCount: a?.n ?? 0, revenue: (a?.kurus ?? 0) / 100 });
  }
  const currentKey = keyOf(ny, nm);
  return {
    months,
    total: totalKurus / 100,
    currentKey,
    currentLabel: labelOf(ny, nm),
    currentRevenue: months.find((r) => r.key === currentKey)?.revenue ?? 0,
  };
}

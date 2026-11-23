/** Aylık ciro (saf fonksiyon). Ay, createdAt'in Europe/Istanbul takvimine göredir. Tutarlar kuruş tamsayısı olarak toplanır. */
import { excludingVat, vatIncluded } from "./vat.ts";

export const MONTH_NAMES_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export const NO_CARRIER_LABEL = "Belirtilmemiş";

export type CarrierShipping = { name: string; total: number; count: number };
/** Tahmini KDV (KDV dahil tutarlardan, aylık toplam üzerinden). */
export type VatBreakdown = { salesVat: number; shippingVat: number; revenueExVat: number; afterShippingExVat: number };
/** Kargo alanları: shipping = kayıtlı kargo ücretleri toplamı; afterShipping = ciro − kargo gideri; shipRecorded/cargoOrders = kargo ücreti kayıtlı / kargo ile giden sipariş sayısı. */
export type ShippingExtras = { shipping: number; afterShipping: number; shipRecorded: number; cargoOrders: number; carriers: CarrierShipping[]; vat: VatBreakdown };
export type MonthRow = { key: string; label: string; orderCount: number; revenue: number } & ShippingExtras;
export type MonthlyRevenue = {
  months: MonthRow[];
  total: number;
  currentKey: string;
  currentLabel: string;
  currentRevenue: number;
  /** Tüm aylar toplamı */
  totals: { orderCount: number; revenue: number } & ShippingExtras;
  /** Bu ay (satır yoksa sıfırlı) */
  current: MonthRow;
};

/** KDV ayrıntısı: kuruş tamsayılarından, aylık toplam üzerinden tek yuvarlama. */
export function vatBreakdown(revenueKurus: number, shippingKurus: number): VatBreakdown {
  return {
    salesVat: vatIncluded(revenueKurus) / 100,
    shippingVat: vatIncluded(shippingKurus) / 100,
    revenueExVat: excludingVat(revenueKurus) / 100,
    afterShippingExVat: excludingVat(revenueKurus - shippingKurus) / 100,
  };
}

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit" });

/** [yıl, ay(1-12)] — İstanbul takvimine göre. */
function ym(d: Date): [number, number] {
  const parts = fmt.formatToParts(d);
  return [Number(parts.find((p) => p.type === "year")?.value), Number(parts.find((p) => p.type === "month")?.value)];
}
const keyOf = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const labelOf = (y: number, m: number) => `${MONTH_NAMES_TR[m - 1]} ${y}`;

/** Veritabanından gelen aylık satır: key = "YYYY-MM" (İstanbul takvimi), n = sipariş adedi, kurus = toplam tutar (kuruş tamsayısı). */
export type MonthAggRow = { key: string; n: number; kurus: number; carrier?: string; shipKurus?: number; shipN?: number; cargoN?: number };

export function monthlyRevenue(orders: { createdAt: Date; totalAmount: number }[], now: Date): MonthlyRevenue {
  const agg = new Map<string, MonthAggRow>();
  for (const o of orders) {
    const [y, m] = ym(o.createdAt);
    const k = keyOf(y, m);
    const a = agg.get(k) ?? { key: k, n: 0, kurus: 0 };
    a.n += 1;
    a.kurus += Math.round(o.totalAmount * 100);
    agg.set(k, a);
  }
  return monthlyRevenueFromRows([...agg.values()], now);
}

type Acc = { n: number; kurus: number; shipKurus: number; shipN: number; cargoN: number; carriers: Map<string, { kurus: number; n: number }> };
const newAcc = (): Acc => ({ n: 0, kurus: 0, shipKurus: 0, shipN: 0, cargoN: 0, carriers: new Map() });

function addTo(a: Acc, r: Pick<MonthAggRow, "n" | "kurus" | "shipKurus" | "shipN" | "cargoN"> & { carrier?: string }) {
  a.n += r.n;
  a.kurus += r.kurus;
  a.shipKurus += r.shipKurus ?? 0;
  a.shipN += r.shipN ?? 0;
  a.cargoN += r.cargoN ?? 0;
  if ((r.shipN ?? 0) > 0) {
    const name = r.carrier?.trim() || NO_CARRIER_LABEL;
    const c = a.carriers.get(name) ?? { kurus: 0, n: 0 };
    c.kurus += r.shipKurus ?? 0;
    c.n += r.shipN ?? 0;
    a.carriers.set(name, c);
  }
}

function extras(a: Acc): ShippingExtras {
  return {
    shipping: a.shipKurus / 100,
    afterShipping: (a.kurus - a.shipKurus) / 100,
    shipRecorded: a.shipN,
    cargoOrders: a.cargoN,
    carriers: [...a.carriers].map(([name, c]) => ({ name, total: c.kurus / 100, count: c.n })).sort((x, y) => y.total - x.total || x.name.localeCompare(y.name, "tr")),
    vat: vatBreakdown(a.kurus, a.shipKurus),
  };
}

/** Aylık ciro, veritabanında ay (ve kargo firması) bazında gruplanmış satırlardan (tek GROUP BY sorgusu). Aynı ay birden çok satırsa toplanır. */
export function monthlyRevenueFromRows(rows: MonthAggRow[], now: Date): MonthlyRevenue {
  const [ny, nm] = ym(now);
  const agg = new Map<string, Acc>();
  const all = newAcc();
  let first = ny * 12 + (nm - 1);
  let last = first;
  for (const r of rows) {
    const [y, m] = r.key.split("-").map(Number);
    const idx = y * 12 + (m - 1);
    if (idx < first) first = idx;
    if (idx > last) last = idx;
    const a = agg.get(r.key) ?? newAcc();
    addTo(a, r);
    addTo(all, r);
    agg.set(r.key, a);
  }
  const months: MonthRow[] = [];
  for (let idx = last; idx >= first; idx--) {
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const a = agg.get(keyOf(y, m)) ?? newAcc();
    months.push({ key: keyOf(y, m), label: labelOf(y, m), orderCount: a.n, revenue: a.kurus / 100, ...extras(a) });
  }
  const currentKey = keyOf(ny, nm);
  const current = months.find((r) => r.key === currentKey) ?? { key: currentKey, label: labelOf(ny, nm), orderCount: 0, revenue: 0, ...extras(newAcc()) };
  return {
    months,
    total: all.kurus / 100,
    currentKey,
    currentLabel: labelOf(ny, nm),
    currentRevenue: current.revenue,
    totals: { orderCount: all.n, revenue: all.kurus / 100, ...extras(all) },
    current,
  };
}

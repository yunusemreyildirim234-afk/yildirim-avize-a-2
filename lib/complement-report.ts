// "Tamamlayıcı Satışlar" raporu: SAF toplayıcı (veritabanı yok).
// Kaynak: OrderItem.bundleMainProductId dolu kalemler. Sipariş OLUŞTURULMA tarihine göre; ciro ekranıyla aynı kuralla
// ödenmemiş, onay bekleyen Havale, iptal ve iade edilmiş siparişler sayılmaz (isCountedOrder), yalnız sayısı bildirilir.
import { isCountedOrder } from "@/lib/orderStatus";

export const COMPLEMENT_REPORT_LIMIT = 5000;

export interface ComplementReportRow {
  orderId: string;
  orderStatus: string;
  orderCreatedAt: Date | string | number;
  quantity: number;
  unitPrice: number; // indirimli birim fiyat
  bundleMainProductId: string | null;
  bundleDiscount: number | null; // kalemin toplam TL indirimi
  complementProductId: string; // kalemin ürünü (variation.productId)
}

export interface ReportTotals {
  quantity: number;
  orders: number;
  list: number; // liste tutarı = net + indirim
  discount: number;
  net: number;
}
export interface ComplementPair extends ReportTotals {
  mainId: string;
  complementId: string;
}
export interface ReportGroup extends ReportTotals {
  id: string;
  items: ComplementPair[]; // ana görünümde tamamlayıcılar, ters görünümde ana ürünler (id karşı ürün)
}
export interface ComplementReport {
  summary: ReportTotals;
  byMain: ReportGroup[];
  byComplement: ReportGroup[];
  excludedOrders: number; // ödeme/iptal/iade nedeniyle sayılmayan, bağlı kalemi olan sipariş sayısı
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface Acc {
  quantity: number;
  net: number;
  discount: number;
  orders: Set<string>;
}
const empty = (): Acc => ({ quantity: 0, net: 0, discount: 0, orders: new Set() });
const add = (a: Acc, orderId: string, quantity: number, net: number, discount: number) => {
  a.quantity += quantity;
  a.net += net;
  a.discount += discount;
  a.orders.add(orderId);
};
const totals = (a: Acc): ReportTotals => ({ quantity: a.quantity, orders: a.orders.size, list: round2(a.net + a.discount), discount: round2(a.discount), net: round2(a.net) });
const byDiscount = (a: ReportTotals & { id?: string }, b: ReportTotals & { id?: string }) => b.discount - a.discount || b.net - a.net || String(a.id ?? "").localeCompare(String(b.id ?? ""));

export function buildComplementReport(rows: ComplementReportRow[], range?: { start: number; end: number } | null): ComplementReport {
  const total = empty();
  const mains = new Map<string, Acc>();
  const comps = new Map<string, Acc>();
  const pairs = new Map<string, Acc>();
  const excluded = new Set<string>();

  for (const r of rows) {
    // Bağlı olmayan kalem (NULL) rapora girmez; indirimi okunamayan kalem de sayılmaz
    if (!r.bundleMainProductId || r.bundleDiscount === null || !Number.isFinite(r.bundleDiscount) || !Number.isFinite(r.unitPrice) || !(r.quantity > 0)) continue;
    // Tarih: sipariş oluşturulma anı (sorgu da süzer; saf işlev tek başına doğru kalsın diye burada da denetlenir)
    const t = new Date(r.orderCreatedAt).getTime();
    if (range && !(t >= range.start && t < range.end)) continue;
    if (!isCountedOrder(r.orderStatus)) {
      excluded.add(r.orderId);
      continue;
    }
    const net = r.unitPrice * r.quantity;
    const slot = (m: Map<string, Acc>, key: string) => m.get(key) ?? m.set(key, empty()).get(key)!;
    add(total, r.orderId, r.quantity, net, r.bundleDiscount);
    add(slot(mains, r.bundleMainProductId), r.orderId, r.quantity, net, r.bundleDiscount);
    add(slot(comps, r.complementProductId), r.orderId, r.quantity, net, r.bundleDiscount);
    add(slot(pairs, `${r.bundleMainProductId}\u0000${r.complementProductId}`), r.orderId, r.quantity, net, r.bundleDiscount);
  }

  const pairList: ComplementPair[] = [...pairs.entries()].map(([k, a]) => {
    const [mainId, complementId] = k.split("\u0000");
    return { mainId, complementId, ...totals(a) };
  });
  const group = (m: Map<string, Acc>, side: "main" | "complement"): ReportGroup[] =>
    [...m.entries()]
      .map(([id, a]) => ({
        id,
        ...totals(a),
        items: pairList
          .filter((p) => (side === "main" ? p.mainId : p.complementId) === id)
          .sort((x, y) => byDiscount({ ...x, id: side === "main" ? x.complementId : x.mainId }, { ...y, id: side === "main" ? y.complementId : y.mainId })),
      }))
      .sort(byDiscount);

  return { summary: totals(total), byMain: group(mains, "main"), byComplement: group(comps, "complement"), excludedOrders: excluded.size };
}

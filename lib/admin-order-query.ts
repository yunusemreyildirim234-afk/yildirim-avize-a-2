// Yönetim paneli sipariş listesi: durum grupları ve tarih aralığının SUNUCU sorgusuna çevrilmesi (saf; veritabanı yok).
// Gruplar lib/orderStatus.ts ORDER_GROUPS ile birebir aynı sonucu vermek zorundadır (tests/admin-siparis-sorgu.test.mjs bunu sınar).
import { ALL_GROUP_KEYS, ORDER_GROUPS, matchesGroups, type OrderGroupKey } from "./orderStatus.ts";

/** Listede gösterilen en çok sipariş (sayfalama yok); fazlası için arama/tarih süzgeci kullanılır. */
export const ORDER_LIST_LIMIT = 100;

export type OrderWhereFragment = { status: { in: string[] } } | { cancelReturnStatus: string };

/** Her grubun veritabanı karşılığı (ORDER_GROUPS[].test ile aynı kural). */
export const GROUP_WHERE: Record<OrderGroupKey, OrderWhereFragment> = {
  yeni: { status: { in: ["PENDING", "PENDING_NEW"] } },
  hazir: { status: { in: ["READY_FOR_PICKUP"] } },
  kargoda: { status: { in: ["SHIPPED"] } },
  teslim: { status: { in: ["DELIVERED"] } },
  iptal: { status: { in: ["CANCELLED"] } },
  iade: { status: { in: ["RETURNED"] } },
  talep: { cancelReturnStatus: "PENDING" },
  odeme: { status: { in: ["AWAITING_PAYMENT", "PAYMENT_FAILED", "PENDING_NEW"] } },
};

/** Seçili gruplardan en az birine giren siparişler; bütün gruplar seçiliyse süzgeç yok (null). */
export function groupsWhere(keys: readonly OrderGroupKey[]): { OR: OrderWhereFragment[] } | null {
  if (keys.length >= ALL_GROUP_KEYS.length) return null;
  return { OR: keys.map((k) => GROUP_WHERE[k]) };
}

/** Arama ya da tarih süzgeci açıkken ve ?durum= verilmemişken tüm durumlarda aranır (teslim/iptal siparişler de bulunur); açık durum seçimi her zaman geçerlidir. */
export function effectiveDurum(durum: string | undefined, filtered: boolean): string | undefined {
  return durum === undefined && filtered ? "tumu" : durum;
}

export interface StatusRow {
  status: string;
  cancelReturnStatus: string | null;
  n: number;
}

/** (durum, talep durumu) kümelerinden grup sayaçları ve toplam: ORDER_GROUPS.test ile hesaplanır, bugünkü bellek içi sayımla aynıdır. */
export function countGroups(rows: StatusRow[]): { counts: Record<OrderGroupKey, number>; total: number } {
  const counts = Object.fromEntries(ORDER_GROUPS.map((g) => [g.key, rows.filter((r) => g.test(r)).reduce((s, r) => s + r.n, 0)])) as Record<OrderGroupKey, number>;
  return { counts, total: rows.reduce((s, r) => s + r.n, 0) };
}

/** Seçili gruplara giren sipariş sayısı. */
export function countVisible(rows: StatusRow[], keys: readonly OrderGroupKey[]): number {
  return rows.filter((r) => matchesGroups(r, keys)).reduce((s, r) => s + r.n, 0);
}

/** Sonsuz uçlu aralığı Prisma createdAt filtresine çevirir; aralık yoksa null. */
export function dateWhere(range: { start: number; end: number } | null): { createdAt: { gte?: Date; lt?: Date } } | null {
  if (!range) return null;
  const createdAt: { gte?: Date; lt?: Date } = {};
  if (Number.isFinite(range.start)) createdAt.gte = new Date(range.start);
  if (Number.isFinite(range.end)) createdAt.lt = new Date(range.end);
  return { createdAt };
}

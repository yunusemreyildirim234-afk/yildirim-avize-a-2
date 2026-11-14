// Bildirim zili "özet" mantığı (saf, bağımlılıksız): liste yerine yalnız okunmamış sayısı + en yeni bildirim tarihi.

export interface SummaryGroup {
  read: boolean;
  count: number;
  latest: Date | null;
}

export interface NotificationSummary {
  unread: number;
  /** En yeni bildirimin ISO tarihi (okunmuş olsa da); hiç yoksa null */
  latest: string | null;
}

/** `groupBy(read)` satırlarından özet üretir (tek sorgu). */
export function summarizeGroups(groups: SummaryGroup[]): NotificationSummary {
  let unread = 0;
  let latest: Date | null = null;
  for (const g of groups) {
    if (!g.read) unread += g.count;
    if (g.latest && (!latest || g.latest > latest)) latest = g.latest;
  }
  return { unread, latest: latest ? latest.toISOString() : null };
}

/** Kapsam filtresini (sahiplik denetimi çağıran tarafta kurulur) alıp özeti hesaplar; depo testte sahte verilir. */
export async function getNotificationSummary<W>(store: { groupBy(where: W): Promise<SummaryGroup[]> }, where: W): Promise<NotificationSummary> {
  return summarizeGroups(await store.groupBy(where));
}

/** İki özet arasındaki fark: yeni bildirim düştü mü (tam liste çekilir), yoksa yalnız sayı mı değişti (yalnız rozet). */
export function summaryChanged(prev: NotificationSummary, next: NotificationSummary): { newItems: boolean; badge: boolean } {
  const newItems = next.latest !== null && (prev.latest === null || next.latest > prev.latest);
  return { newItems, badge: prev.unread !== next.unread };
}

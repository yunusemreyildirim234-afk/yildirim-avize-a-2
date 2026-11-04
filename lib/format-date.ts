// Tarih biçimleme (saf). Yönetici sipariş tarihleri her zaman Europe/Istanbul saatiyle gösterilir;
// sunucu ya da tarayıcı saat diliminden bağımsızdır.

const TZ = "Europe/Istanbul";

const fmt = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "04.11.2026" ve "20:31" parçaları (İstanbul saati). Geçersiz tarihte null. */
export function istanbulDateTimeParts(d: Date | string | number): { date: string; time: string } | null {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(dt)) p[x.type] = x.value;
  return { date: `${p.day}.${p.month}.${p.year}`, time: `${p.hour}:${p.minute}` };
}

/** "04.11.2026 20:31" (İstanbul saati). Geçersiz tarihte "—". */
export function formatIstanbulDateTime(d: Date | string | number): string {
  const x = istanbulDateTimeParts(d);
  return x ? `${x.date} ${x.time}` : "—";
}

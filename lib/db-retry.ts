// Veritabanı bağlantı hatası için tek seferlik yeniden deneme (saf yardımcı; Prisma'ya bağımlı değil).
//
// Gerçek hata biçimleri (@prisma/adapter-pg 7.10 + pg-pool, yerel sahte sunucularla doğrulandı):
//  - Havuz bekleme süresi doldu:  düz Error, message "timeout exceeded when trying to connect"        (sorgu GİTMEDİ)
//  - Bağlanma süresi doldu:       düz Error, message "Connection terminated due to connection timeout",
//                                 cause "Connection terminated unexpectedly"                           (sorgu GİTMEDİ)
//  - Sunucu ulaşılamıyor:         PrismaClientKnownRequestError code P1001 (ECONNREFUSED/ENOTFOUND)    (sorgu GİTMEDİ)
//  - Bağlantı kapandı:            code P1017 (ECONNRESET) ya da düz Error "Connection terminated unexpectedly"
//                                 → sorgu gönderildikten sonra da olabilir (belirsiz)
// Yazmada yalnızca "sorgu gitmedi" sınıfı denenir; belirsiz sınıf yalnızca okumada denenir (çift işlem riski).

export const RETRY_DELAY_MS = 500;

export type DbErrorClass = "connect" | "ambiguous" | "other";

const CONNECT_MESSAGES = new Set(["timeout exceeded when trying to connect", "Connection terminated due to connection timeout"]);
const CONNECT_CODES = new Set(["P1001"]);
const AMBIGUOUS_CODES = new Set(["P1017", "ECONNRESET", "ETIMEDOUT", "EPIPE"]);

const READ_OPERATIONS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany",
  "count", "aggregate", "groupBy", "$queryRaw", "$queryRawUnsafe", "findRaw", "aggregateRaw",
]);

/** Bilinmeyen işlem adı yazma sayılır (güvenli taraf). */
export function isReadOperation(operation: string): boolean {
  return READ_OPERATIONS.has(operation);
}

function asObject(e: unknown): { message?: unknown; code?: unknown; cause?: unknown } | null {
  return typeof e === "object" && e !== null ? e : null;
}

export function classifyDbError(err: unknown): DbErrorClass {
  const top = asObject(err);
  if (!top) return "other";
  if (typeof top.message === "string" && CONNECT_MESSAGES.has(top.message.trim())) return "connect";
  if (typeof top.code === "string" && CONNECT_CODES.has(top.code)) return "connect";
  // cause zincirinde (en çok 5 halka) bağlantı kopması izi ara
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur; i++) {
    const o = asObject(cur);
    if (!o) break;
    if (typeof o.code === "string" && AMBIGUOUS_CODES.has(o.code)) return "ambiguous";
    if (typeof o.message === "string" && /Connection terminated/i.test(o.message)) return "ambiguous";
    cur = o.cause;
  }
  return "other";
}

export function shouldRetry(err: unknown, operation: string): boolean {
  const cls = classifyDbError(err);
  return cls === "connect" || (cls === "ambiguous" && isReadOperation(operation));
}

/** `run`ı çalıştırır; uygun bağlantı hatasında en fazla 1 kez, kısa gecikmeyle yeniden dener. İki deneme de düşerse İLK hata fırlatılır. */
export async function withDbRetry<T>(
  run: () => Promise<T>,
  operation: string,
  delayMs: number = RETRY_DELAY_MS,
): Promise<T> {
  try {
    return await run();
  } catch (first) {
    if (!shouldRetry(first, operation)) throw first;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      return await run();
    } catch {
      throw first;
    }
  }
}

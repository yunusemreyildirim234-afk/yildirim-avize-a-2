export const MAX_ATTEMPTS = 5;
/** E-posta başına (IP'den ve koddan bağımsız) ATTEMPT_WINDOW_MS içindeki toplam yanlış deneme üst sınırı. */
export const MAX_ATTEMPTS_PER_EMAIL = 10;
export const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

/** consumeCode'un ihtiyaç duyduğu depo işlemleri (testte sahte depo verilir). */
export interface CodeStore {
  findActive(email: string, type: string): Promise<{ id: string; code: string } | null>;
  /** E-postanın son pencere içindeki kodlarında biriken toplam yanlış deneme sayısı. */
  recentAttempts(email: string, since: Date): Promise<number>;
  /** Atomik: attempts = attempts + 1; MAX_ATTEMPTS'e ulaşınca used = true; yalnız used = false satırda. */
  recordWrong(id: string): Promise<void>;
  /** Koşullu (used = false) tek seferlik tüketim; yalnız kazanan true alır. */
  claim(id: string): Promise<boolean>;
}

/** Kod doğru, süresi dolmamış ve kullanılmamışsa tüketir. Yanlış denemede sayaç atomik artar (5'te kod yanar); e-posta başına 10 dk'da en çok 10 yanlış denemeden sonra doğru kod da kabul edilmez. */
export async function consumeWith(store: CodeStore, email: string, type: string, code: string, now = Date.now()): Promise<boolean> {
  const active = await store.findActive(email, type);
  if (!active) return false;
  if ((await store.recentAttempts(email, new Date(now - ATTEMPT_WINDOW_MS))) >= MAX_ATTEMPTS_PER_EMAIL) return false;
  if (active.code !== code.trim()) {
    await store.recordWrong(active.id);
    return false;
  }
  return store.claim(active.id);
}

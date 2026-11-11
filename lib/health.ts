// Healthcheck çekirdeği (saf; veritabanı yoklaması parametredir, test edilebilir).

export const HEALTH_DB_TIMEOUT_MS = 3_000;

/** `ping` süre içinde tamamlanmazsa ya da hata verirse false. */
export async function dbHealthy(ping: () => Promise<unknown>, timeoutMs: number = HEALTH_DB_TIMEOUT_MS): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([ping(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), timeoutMs); })]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Sipariş kaydından SONRAKİ en iyi çaba adımları ve misafir kullanıcı yarışı için saf yardımcılar.

/** Adımı çalıştırır; hata atarsa loglar ve false döner (çağıran akış bozulmaz). */
export async function bestEffort(label: string, step: () => Promise<unknown>, log: (...a: unknown[]) => void = console.error): Promise<boolean> {
  try {
    await step();
    return true;
  } catch (e) {
    log(`[${label}] adım başarısız (sipariş kaydı etkilenmedi):`, (e as Error)?.message ?? e);
    return false;
  }
}

/** Prisma benzersizlik ihlali (P2002) mi? */
export const isUniqueViolation = (e: unknown) => (e as { code?: string } | null)?.code === "P2002";

/**
 * Misafir kullanıcıyı oluşturur; eşzamanlı istek aynı e-postayı önce oluşturduysa (P2002) kaydı yeniden bulur.
 * Bulunan kayıt misafir değilse (arada hesap açılmış) özgün hata yeniden fırlatılır.
 */
export async function createOrFindGuest<T extends { password: string }>(deps: { create: () => Promise<T>; find: () => Promise<T | null> }, guestPassword: string): Promise<T> {
  try {
    return await deps.create();
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const found = await deps.find();
    if (found && found.password === guestPassword) return found;
    throw e;
  }
}

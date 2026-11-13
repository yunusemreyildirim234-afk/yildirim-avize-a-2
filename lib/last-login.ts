// Son giriş (User.lastLoginAt): her girişte DEĞİL, 24 saatte en çok bir kez yazılır. Okuma yok: tek koşullu updateMany.
export const LAST_LOGIN_MIN_GAP_MS = 24 * 60 * 60 * 1000;

export interface LastLoginStore {
  updateMany(args: { where: { id: string; OR: ({ lastLoginAt: null } | { lastLoginAt: { lt: Date } })[] }; data: { lastLoginAt: Date } }): Promise<unknown>;
}

/** Hata girişi engellemez (yutulur ve loglanır). */
export async function touchLastLogin(store: LastLoginStore, userId: string, now = new Date()): Promise<void> {
  try {
    await store.updateMany({
      where: { id: userId, OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: new Date(now.getTime() - LAST_LOGIN_MIN_GAP_MS) } }] },
      data: { lastLoginAt: now },
    });
  } catch (err) {
    console.error("[son-giris] yazılamadı:", (err as Error)?.message ?? "bilinmeyen hata");
  }
}

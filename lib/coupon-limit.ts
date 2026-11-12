// Admin kupon formu: "Kullanım Limiti" boş bırakılırsa sınırsız (sunucu üst sınır koymaz; 1.000.000 ve üstü sınırsız gösterilir).
export const UNLIMITED_USES = 1_000_000;

/** Form değerini gönderilecek sayıya çevirir: boş / yalnız boşluk → UNLIMITED_USES. */
export const parseMaxUses = (raw: string): number => (raw.trim() === "" ? UNLIMITED_USES : Number(raw));

export const isUnlimitedUses = (maxUses: number): boolean => maxUses >= UNLIMITED_USES;

/** Liste gösterimi: "3 / ∞" ve "Sınırsız" ya da "Kalan: N". */
export function usesLabels(usedCount: number, maxUses: number): { used: string; rest: string } {
  return isUnlimitedUses(maxUses)
    ? { used: `${usedCount} / ∞`, rest: "Sınırsız" }
    : { used: `${usedCount} / ${maxUses}`, rest: `Kalan: ${Math.max(0, maxUses - usedCount)}` };
}

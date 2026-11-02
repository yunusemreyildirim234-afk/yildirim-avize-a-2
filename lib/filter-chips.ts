/** Akıllı çip seçimi: seçili çipe tekrar tıklamak kaldırır, değilse ekler. Boş dizi = "Tümü" (filtre yok). */
export function toggleSelection<T extends string>(selected: readonly T[], key: T): T[] {
  return selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
}

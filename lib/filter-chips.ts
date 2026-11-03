/** Akıllı çip seçimi: seçili çipe tekrar tıklamak kaldırır, değilse ekler. Boş dizi = "Tümü" (filtre yok). */
export function toggleSelection<T extends string>(selected: readonly T[], key: T): T[] {
  return selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
}

export type ChipMode = "default" | "all" | "custom";

/**
 * ?durum= değerinden filtre durumu: parametre yok → "default" (aktif işler ön ayarı); "tumu" (veya geçerli anahtar yok / hepsi) → "all";
 * diğer → "custom" (özel seçim; varsayılan kümeye eşit olsa bile özel sayılır).
 */
export function chipState<T extends string>(param: string | undefined, allKeys: readonly T[], defaultKeys: readonly T[]): { mode: ChipMode; keys: T[] } {
  if (param === undefined) return { mode: "default", keys: [...defaultKeys] };
  const wanted = param.split(",").map((k) => k.trim());
  const keys = allKeys.filter((k) => wanted.includes(k));
  if (param === "tumu" || keys.length === 0 || keys.length === allKeys.length) return { mode: "all", keys: [...allKeys] };
  return { mode: "custom", keys };
}

/** Bir çipe tıklayınca yeni ?durum= değeri (undefined = parametre yok → varsayılan ön ayar). */
export function nextParam<T extends string>(param: string | undefined, clicked: T | "tumu", allKeys: readonly T[], defaultKeys: readonly T[]): string | undefined {
  if (clicked === "tumu") return "tumu";
  const { mode, keys } = chipState(param, allKeys, defaultKeys);
  if (mode !== "custom") return clicked; // ön ayardayken tıklanan grup izole edilir
  const next = keys.includes(clicked) ? keys.filter((k) => k !== clicked) : allKeys.filter((k) => keys.includes(k) || k === clicked);
  if (next.length === 0) return undefined; // son çip de çıktı → varsayılana dön
  if (next.length === allKeys.length) return "tumu";
  return next.join(",");
}

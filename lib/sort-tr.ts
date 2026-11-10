/** Ada göre Türkçe alfabetik sıralama (Ç, Ğ, İ, Ö, Ş, Ü doğru yerde); girdi dizisini değiştirmez. */
export function sortByNameTr<T extends { name: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

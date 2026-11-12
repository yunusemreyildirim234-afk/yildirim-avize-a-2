// Gösterim için Türkçe baş harf büyütme (kayıtlı veri değişmez). Kelime başındaki harf toLocaleUpperCase("tr") ile büyütülür; kalanı olduğu gibi kalır.
export function titleCaseTr(text: string): string {
  return text.replace(/(^|[\s(/-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase("tr"));
}

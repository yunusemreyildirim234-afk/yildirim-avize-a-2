/** KVKK: "Ahmet Yılmaz" → "Ahmet Y." */
export function maskName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "Müşteri";
  return `${parts.slice(0, -1).join(" ")} ${parts[parts.length - 1][0].toLocaleUpperCase("tr-TR")}.`;
}

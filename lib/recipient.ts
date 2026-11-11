// Teslimat alıcı adı: siparişte kayıtlı alıcı adı (sepet formu) varsa o, yoksa (eski siparişler) hesap adı.
// Saf ve bağımsız. "Sayın ..." hitabı ve fatura e-postası HESAP adıyla (user.name) kalır; alıcı adı yalnızca teslimat bağlamında kullanılır.

export interface RecipientSource {
  recipientName?: string | null;
  user: { name: string };
}

export const recipientOf = (o: RecipientSource): string => o.recipientName?.trim() || o.user.name;

/** Alıcı adı hesap adından farklı mı? (boşluk ve büyük/küçük harf farkı sayılmaz) */
export function recipientDiffers(o: RecipientSource): boolean {
  const r = o.recipientName?.trim();
  if (!r) return false;
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
  return norm(r) !== norm(o.user.name);
}

/** Admin görünümü: ad farklıysa "Alıcı: X (sipariş veren: Y)", değilse yalnızca ad. */
export function recipientLabel(o: RecipientSource): string {
  return recipientDiffers(o) ? `Alıcı: ${recipientOf(o)} (sipariş veren: ${o.user.name})` : o.user.name;
}

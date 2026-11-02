/** Misafir siparişinde benzersizlik için eklenen "+misafirXXXX" etiketini kaldırır; gerçek gönderim/görünüm adresini verir. */
export function cleanGuestEmail(email: string) {
  return email.replace(/\+misafir[a-z0-9]+@/i, "@");
}

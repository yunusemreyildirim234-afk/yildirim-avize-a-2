/** Girişli müşteride sipariş e-postası hesabın e-postasıdır (gövdedeki değer yok sayılır); misafirde gövdedeki e-posta aynen kalır. */
export function effectiveOrderEmail(accountEmail: string | null | undefined, bodyEmail: string): string {
  return accountEmail?.trim() ? accountEmail : bodyEmail;
}

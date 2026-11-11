/** Kişiye özel kupon: yalnızca giriş yapmış ve hesap e-postası kuponunkiyle eşleşen kullanıcıda geçerli (misafir/eşleşmeyen hesap aynı metni alır). */
export const COUPON_PERSONAL_ERROR = "Bu kupon için ilgili hesapla giriş yapmanız gerekir";

/** Kupon kişiye özelse (couponEmail dolu) ve hesap e-postası eşleşmiyorsa hata metni, aksi halde null. Herkese açık kupon (boş) her zaman null. */
export function personalCouponError(couponEmail: string | null | undefined, accountEmail: string | null | undefined): string | null {
  const wanted = (couponEmail ?? "").trim().toLowerCase();
  if (!wanted) return null;
  const account = (accountEmail ?? "").trim().toLowerCase();
  return account && account === wanted ? null : COUPON_PERSONAL_ERROR;
}

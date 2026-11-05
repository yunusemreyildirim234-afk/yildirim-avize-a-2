/** Telefon biçimi: yalnızca rakam, boşluk, +, (, ), - ; en az 10, en çok 13 rakam. Sepet formu ve /api/order aynı fonksiyonu kullanır. */
const PHONE_CHARS = /^[0-9 +()-]+$/;

export const PHONE_ERROR = "Geçerli bir telefon numarası giriniz (Örn: 0555 123 45 67).";

export function isValidPhone(phone: string): boolean {
  const value = phone.trim();
  if (!PHONE_CHARS.test(value)) return false;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 10 && digits <= 13;
}

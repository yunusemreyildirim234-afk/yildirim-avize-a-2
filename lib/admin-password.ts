// Yönetici paneli: e-posta maskeleme, 2FA düğme kararı ve şifre değiştirme kuralları (saf yardımcılar; veritabanı/ortam yok, test edilebilir).

/** Tam adres arayüze/loglara yazılmaz: a***@alan.com */
export const maskEmail = (email: string) => email.replace(/^(.).*@/, "$1***@");

/** Satırdaki düğme: 2FA açıksa "Kapat", kapalıysa "Aç". */
export function twoFactorButton(enabled: boolean): { label: "Kapat" | "Aç"; badge: "2FA açık" | "2FA kapalı" } {
  return enabled ? { label: "Kapat", badge: "2FA açık" } : { label: "Aç", badge: "2FA kapalı" };
}

export interface PasswordChangeInput {
  account: { role: string } | null;
  currentOk: boolean;
  strong: boolean; // isStrongPassword(yeniŞifre) (müşterilerle aynı kurallar; çağıran hesaplar)
  newPassword: string;
  confirm: string;
}

/**
 * Kod tüketilmeden ÖNCE yapılan denetimler (zayıf şifre kodu yakmasın). Hata varsa { status, error }, yoksa null.
 * Hesap yalnızca role=ADMIN User olabilir; .env ortak kimliği bir User değildir ve burada reddedilir.
 */
export function passwordChangeError(i: PasswordChangeInput): { status: number; error: string } | null {
  if (!i.account || i.account.role !== "ADMIN") return { status: 401, error: "E-posta veya mevcut şifre hatalı ya da bu hesap yönetici hesabı değil." };
  if (!i.currentOk) return { status: 401, error: "E-posta veya mevcut şifre hatalı ya da bu hesap yönetici hesabı değil." };
  if (!i.strong) return { status: 400, error: "Şifre en az 8 karakter olmalı; büyük harf, küçük harf, rakam ve özel karakter içermelidir." };
  if (i.newPassword !== i.confirm) return { status: 400, error: "Yeni şifre ve tekrarı aynı değil." };
  return null;
}

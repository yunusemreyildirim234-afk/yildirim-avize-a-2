// Yönetici girişi 2FA kararları (saf yardımcılar; veritabanı/ortam yok, test edilebilir).
// 2FA durumu User.twoFactorEnabled alanında kullanıcı başına tutulur; bir yöneticinin ayarı diğerini etkilemez.

/** Doğrulanmış bekleyen yönetici girişi jetonunun amacı (müşteri "2fa-login" jetonundan ayrı). */
export const ADMIN_2FA_PURPOSE = "admin-2fa-login";

export interface AdminAccount {
  id: string;
  role: string;
  twoFactorEnabled: boolean;
}

export type AdminLoginPlan = "DENY" | "COOKIE" | "NEED_CODE";

/**
 * Şifre adımından sonra ne olur?
 * - kimlik bilgisi geçersiz → DENY;
 * - giriş adı bir veritabanı yöneticisiyle (role=ADMIN) eşleşiyor ve o hesapta 2FA açık → NEED_CODE (çerez VERİLMEZ);
 * - aksi halde (2FA kapalı veya yalnızca .env kullanıcı adı, hesap eşleşmesi yok) → COOKIE (eski akış).
 */
export function planAdminLogin(credsOk: boolean, account: AdminAccount | null): AdminLoginPlan {
  if (!credsOk) return "DENY";
  if (account && account.role === "ADMIN" && account.twoFactorEnabled) return "NEED_CODE";
  return "COOKIE";
}

/** Kod adımı: bekleyen jeton aynı hesaba ait, hesap hâlâ yönetici ve 2FA açıksa kod denenebilir. */
export function canVerifyAdminCode(account: AdminAccount | null, proofUid: string | undefined): boolean {
  return !!account && !!proofUid && account.id === proofUid && account.role === "ADMIN" && account.twoFactorEnabled;
}

/** Panelden 2FA açma/kapatma: yönetici hesabı + şifre doğrulaması şart; durum geçişi hesabın MEVCUT durumundan türetilir. */
export function nextTwoFactorAction(account: AdminAccount | null, passwordOk: boolean): "DENY" | "ENABLE" | "DISABLE" {
  if (!account || account.role !== "ADMIN" || !passwordOk) return "DENY";
  return account.twoFactorEnabled ? "DISABLE" : "ENABLE";
}

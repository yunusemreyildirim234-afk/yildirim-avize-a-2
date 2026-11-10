// Zil bildirim kapsamı (saf, bağımlılıksız). Çift oturumda (müşteri + yönetici aynı tarayıcıda) kümeler karışmaz.
export type NotificationScope = "admin" | "user";

export type NotificationScopeWhere = { OR: ({ userId: string } | { userEmail: { equals: string; mode: "insensitive" } } | { userId: null; userEmail: null })[] };

export const parseNotificationScope = (v: unknown): NotificationScope | null => (v === "admin" || v === "user" ? v : null);

/**
 * scope=admin: yalnızca yönetici kümesi (yönetici oturumu şart).
 * scope=user: müşteri oturumu varsa yalnızca müşteri kümesi; müşteri oturumu yoksa yönetici oturumunun kümesi (yalnızca yönetici açıkken herkese açık sayfadaki zil).
 * scope yok: müşteri varsa müşteri; yoksa yönetici (silme için); okuma/okundu için (merge) ikisi birlikte, eski davranış.
 */
export function buildNotificationWhere(
  s: { user: { id: string; email: string } | null; admin: boolean },
  scope: NotificationScope | null,
  mode: "read" | "delete" = "read"
): NotificationScopeWhere | null {
  const userSet = s.user ? [{ userId: s.user.id }, { userEmail: { equals: s.user.email, mode: "insensitive" as const } }] : [];
  const adminSet = s.admin ? [{ userId: null, userEmail: null }] : [];
  let or: NotificationScopeWhere["OR"];
  if (scope === "admin") or = adminSet;
  else if (scope === "user" || (!scope && mode === "delete")) or = userSet.length ? userSet : adminSet;
  else or = [...userSet, ...adminSet];
  return or.length ? { OR: or } : null;
}

// Müşteri iptal/iade talebi için yönetici panel bildirimi (saf; test edilebilir).

/** Talep türüne göre başlık: "İptal talebi: sipariş #xxxxxxxx" / "İade talebi: sipariş #xxxxxxxx". */
export function requestNoticeTitle(type: string, orderId: string): string {
  return `${type === "RETURN" ? "İade" : "İptal"} talebi: sipariş #${orderId.slice(0, 8)}`;
}

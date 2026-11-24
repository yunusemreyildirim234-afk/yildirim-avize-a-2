// Sipariş sahibi olmayan (misafir / oturumsuz / başka hesap) görüntüleyen için iptal-iade yönlendirmesi. Saf fonksiyon: sunucuda hesaplanır.
export type GuestCancelAction =
  | { kind: "none" }
  | { kind: "info"; text: string }
  | { kind: "whatsapp"; label: string; message: (code: string) => string };

const CLOSED = new Set(["CANCELLED", "RETURNED", "PAYMENT_FAILED"]);

export function guestCancelAction(input: { status: string; isOwner: boolean; cancelReturnStatus?: string | null }): GuestCancelAction {
  if (input.isOwner || CLOSED.has(input.status)) return { kind: "none" };
  if (input.cancelReturnStatus) return { kind: "info", text: "Bu sipariş için talep alınmış, sonuç e-posta ile bildirilir." };
  const refund = input.status === "DELIVERED";
  const noun = refund ? "iade" : "iptal";
  return {
    kind: "whatsapp",
    label: `${refund ? "İade" : "İptal"} için WhatsApp'tan yaz`,
    message: (code) => `Merhaba, ${code} kodlu siparişim için ${noun} talebinde bulunmak istiyorum.`,
  };
}

export function guestCancelWaLink(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

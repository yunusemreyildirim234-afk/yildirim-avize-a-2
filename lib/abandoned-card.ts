const HOUR = 60 * 60 * 1000;

/** Kartla ödemesi tamamlanmış sayılan durumlar (PENDING ve sonrası). */
export const PAID_ORDER_STATUSES = ["PENDING", "PREPARING", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED"];

/** Terk edilmiş kartlı ödeme hatırlatması adayı: yarım kalmış (bekleyen/başarısız), kartlı, hatırlatma gönderilmemiş, 2 saat–7 gün arası. */
export function abandonedCardWhere(now: number) {
  return {
    status: { in: ["AWAITING_PAYMENT", "PAYMENT_FAILED"] },
    paymentMethod: "CREDIT_CARD",
    abandonedEmailSent: false,
    createdAt: { lt: new Date(now - 2 * HOUR), gt: new Date(now - 7 * 24 * HOUR) },
  };
}

/** Aynı kullanıcının bu denemeden sonra ödenmiş siparişi varsa hatırlatma gönderilmez. */
export function shouldSendAbandonedReminder(
  order: { createdAt: Date },
  userOrders: { status: string; createdAt: Date }[],
): boolean {
  return !userOrders.some((o) => PAID_ORDER_STATUSES.includes(o.status) && o.createdAt.getTime() > order.createdAt.getTime());
}

import { deletableOrderWhere } from "./stock-rules.ts";

/** Silme sırasında sipariş durumu değiştiyse fırlatılır; işlem geri alınır. */
export class OrderDeleteConflictError extends Error {}

/** İade edilen siparişe fatura yüklenmişse fırlatılır (silinmez); işlem geri alınır. */
export class OrderInvoicedError extends Error {}

export const INVOICED_ORDER_DELETE_ERROR = "Faturası yüklenmiş sipariş silinemez; önce faturayı kaldırmanız gerekir. Hiçbir sipariş silinmedi.";

type Count = Promise<{ count: number }>;
export type DeleteTx = {
  notification: { deleteMany: (a: { where: { link: { in: string[] } } }) => Count };
  receiptFile: { deleteMany: (a: { where: { orderId: { in: string[] } } }) => Count };
  orderInvoice: {
    deleteMany: (a: { where: { orderId: { in: string[] } } }) => Count;
    findMany: (a: { where: { orderId: { in: string[] } }; select: { orderId: true } }) => Promise<{ orderId: string }[]>;
  };
  orderItem: { deleteMany: (a: { where: { orderId: { in: string[] } } }) => Count };
  order: { deleteMany: (a: { where: Record<string, unknown> }) => Count };
};

/** İade edilen (RETURNED) siparişlerden faturası olanların kimlikleri. Fatura verisi (data) okunmaz. */
export async function invoicedReturnedIds(
  find: (a: { where: { orderId: { in: string[] } }; select: { orderId: true } }) => Promise<{ orderId: string }[]>,
  orders: { id: string; status: string }[],
): Promise<string[]> {
  const returned = orders.filter((o) => o.status === "RETURNED").map((o) => o.id);
  if (returned.length === 0) return [];
  return (await find({ where: { orderId: { in: returned } }, select: { orderId: true } })).map((r) => r.orderId);
}

/**
 * Bağımlı kayıtları ve siparişleri siler. Sipariş silme, işlem içinde silinebilir durumu yeniden denetler; silinen sayı istenenden azsa hata fırlatır (işlem geri alınır).
 * İade edilen siparişlerde fatura, silinmeden ÖNCE işlem içinde yeniden denetlenir (fatura varsa OrderInvoicedError).
 */
export async function deleteOrderRowsInTx(
  tx: DeleteTx,
  ids: string[],
  links: string[],
  invoiceTable: boolean,
  now: number,
  orders: { id: string; status: string }[] = [],
): Promise<number> {
  if (invoiceTable && (await invoicedReturnedIds((a) => tx.orderInvoice.findMany(a), orders)).length > 0) throw new OrderInvoicedError(INVOICED_ORDER_DELETE_ERROR);
  await tx.notification.deleteMany({ where: { link: { in: links } } });
  await tx.receiptFile.deleteMany({ where: { orderId: { in: ids } } });
  if (invoiceTable) await tx.orderInvoice.deleteMany({ where: { orderId: { in: ids } } });
  await tx.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  const { count } = await tx.order.deleteMany({ where: { id: { in: ids }, ...deletableOrderWhere(now) } });
  if (count < ids.length) throw new OrderDeleteConflictError("Silme sırasında bazı siparişlerin durumu değişti.");
  return count;
}

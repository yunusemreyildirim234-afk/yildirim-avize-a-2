import { deletableOrderWhere } from "./stock-rules.ts";

/** Silme sırasında sipariş durumu değiştiyse fırlatılır; işlem geri alınır. */
export class OrderDeleteConflictError extends Error {}

type Count = Promise<{ count: number }>;
export type DeleteTx = {
  notification: { deleteMany: (a: { where: { link: { in: string[] } } }) => Count };
  receiptFile: { deleteMany: (a: { where: { orderId: { in: string[] } } }) => Count };
  orderInvoice: { deleteMany: (a: { where: { orderId: { in: string[] } } }) => Count };
  orderItem: { deleteMany: (a: { where: { orderId: { in: string[] } } }) => Count };
  order: { deleteMany: (a: { where: Record<string, unknown> }) => Count };
};

/** Bağımlı kayıtları ve siparişleri siler. Sipariş silme, işlem içinde silinebilir durumu yeniden denetler; silinen sayı istenenden azsa hata fırlatır (işlem geri alınır). */
export async function deleteOrderRowsInTx(tx: DeleteTx, ids: string[], links: string[], invoiceTable: boolean, now: number): Promise<number> {
  await tx.notification.deleteMany({ where: { link: { in: links } } });
  await tx.receiptFile.deleteMany({ where: { orderId: { in: ids } } });
  if (invoiceTable) await tx.orderInvoice.deleteMany({ where: { orderId: { in: ids } } });
  await tx.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  const { count } = await tx.order.deleteMany({ where: { id: { in: ids }, ...deletableOrderWhere(now) } });
  if (count < ids.length) throw new OrderDeleteConflictError("Silme sırasında bazı siparişlerin durumu değişti.");
  return count;
}

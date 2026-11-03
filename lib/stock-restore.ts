// Sipariş stok iadesinin çekirdeği: bayrak güncellemesi ve stok artışları AYNI transaction istemcisi (tx) üzerinde çalışır.
// Saf yardımcı: veritabanı istemcisi parametredir (test edilebilir).

export interface RestoreTx {
  order: { updateMany(args: { where: { id: string; stockDeducted: boolean }; data: { stockDeducted: boolean } }): Promise<{ count: number }> };
  orderItem: { findMany(args: { where: { orderId: string }; select: { variationId: true; quantity: true } }): Promise<{ variationId: string; quantity: number }[]> };
  productVariation: { update(args: { where: { id: string }; data: { stock: { increment: number } } }): Promise<unknown> };
}

/** Düşülmüş stoğu iade eder; bayrak zaten temizse hiçbir şey yapmaz. Tek transaction içinde çağrılmalıdır. */
export async function restoreStockInTx(tx: RestoreTx, orderId: string): Promise<void> {
  const claimed = await tx.order.updateMany({ where: { id: orderId, stockDeducted: true }, data: { stockDeducted: false } });
  if (claimed.count === 0) return;
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { variationId: true, quantity: true } });
  for (const i of items) {
    await tx.productVariation.update({ where: { id: i.variationId }, data: { stock: { increment: i.quantity } } });
  }
}

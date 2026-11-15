import { prisma } from "@/lib/db";
import { coverImageOf } from "@/lib/variation-input";

/** Hafif profil: sipariş, varyasyon ve dekont yüklemeden (varsayılan /api/auth/me yanıtı). */
export async function getCustomerProfile(id: string) {
  return prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, twoFactorEnabled: true } });
}

export const CUSTOMER_ORDER_LIMIT = 20;

/** Hesabım'ın gösterdiği sipariş alanları (açık liste): yönetici/iç alanlar (kargo maliyeti, gönderi/etiket kimliği, hatırlatma bayrakları, vergi bilgisi vb.) yanıta girmez. */
export const CUSTOMER_ORDER_SELECT = {
  id: true,
  createdAt: true,
  updatedAt: true,
  totalAmount: true,
  paymentMethod: true,
  shippingType: true,
  status: true,
  address: true,
  buyerCityName: true,
  buyerStateName: true,
  kargonomiStatus: true,
  kargonomiStatusLabel: true,
  shippingProviderName: true,
  shippingTrackingCode: true,
  cancelReturnType: true,
  cancelReturnStatus: true,
  cancelReturnReason: true,
  cancelReturnNote: true,
  receiptUrl: true,
  receiptSenderName: true,
  items: {
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      productTitle: true,
      variationLabel: true,
      variation: {
        select: { id: true, variationValue: true, product: { select: { id: true, title: true, imageUrl: true, images: true, variations: { orderBy: { position: "asc" }, select: { images: true } } } } },
      },
    },
  },
} as const;

type RawOrderItem = { id: string; quantity: number; unitPrice: number; productTitle: string | null; variationLabel: string | null; variation: { id: string; variationValue: string; product: Parameters<typeof coverImageOf>[0] & { id: string; title: string } } };

/** Sipariş satırı: ürün için yalnızca id/başlık/kapak istemciye gider. */
export function shapeCustomerOrder<O extends { items: RawOrderItem[] }>(o: O) {
  return {
    ...o,
    items: o.items.map((i) => ({ ...i, variation: { ...i.variation, variationValue: i.variationLabel ?? i.variation.variationValue, product: { id: i.variation.product.id, title: i.productTitle ?? i.variation.product.title, imageUrl: coverImageOf(i.variation.product) } } })),
  };
}

/** Yalnızca istemcinin kullandığı müşteri alanları (parola, oturum sürümü yok) + siparişleri. */
export async function getCustomerWithOrders(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, twoFactorEnabled: true } });
  if (!user) return null;
  // Hesaba userId ile bağlı siparişler + aynı e-postaya (harf duyarsız) kayıtlı hesapların siparişleri
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ userId: user.id }, { user: { email: { equals: user.email, mode: "insensitive" } } }],
      // Ödeme ekranını terk eden denemeler müşteri geçmişinde görünmez
      status: { notIn: ["AWAITING_PAYMENT", "PAYMENT_FAILED"] },
    },
    select: CUSTOMER_ORDER_SELECT,
    orderBy: { createdAt: "desc" },
    take: CUSTOMER_ORDER_LIMIT,
  });
  // Küçük resim: tek kapak kuralı (genel fotoğrafın ilki, yoksa ilk rengin fotoğrafı); istemciye yalnızca id/başlık/kapak gider
  return { ...user, orders: orders.map(shapeCustomerOrder) };
}

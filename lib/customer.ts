import { prisma } from "@/lib/db";
import { coverImageOf } from "@/lib/variation-input";

/** Hafif profil: sipariş, varyasyon ve dekont yüklemeden (varsayılan /api/auth/me yanıtı). */
export async function getCustomerProfile(id: string) {
  return prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, twoFactorEnabled: true } });
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
    include: {
      items: {
        include: {
          variation: {
            select: { id: true, variationValue: true, product: { select: { id: true, title: true, imageUrl: true, images: true, variations: { orderBy: { position: "asc" }, select: { images: true } } } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  // Küçük resim: tek kapak kuralı (genel fotoğrafın ilki, yoksa ilk rengin fotoğrafı); istemciye yalnızca id/başlık/kapak gider
  return {
    ...user,
    orders: orders.map((o) => ({
      ...o,
      items: o.items.map((i) => {
        const p = i.variation.product;
        return { ...i, variation: { ...i.variation, product: { id: p.id, title: p.title, imageUrl: coverImageOf(p) } } };
      }),
    })),
  };
}

import { prisma } from "@/lib/db";

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
    include: { items: { include: { variation: { select: { id: true, variationValue: true, product: { select: { id: true, title: true, imageUrl: true } } } } } } },
    orderBy: { createdAt: "desc" },
  });
  return { ...user, orders };
}

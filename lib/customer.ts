import { prisma } from "@/lib/db";

/** Şifre alanı olmadan müşteri + siparişleri. */
export async function getCustomerWithOrders(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;
  // Hesaba userId ile bağlı siparişler + aynı e-postaya (harf duyarsız) kayıtlı hesapların siparişleri
  const orders = await prisma.order.findMany({
    where: { OR: [{ userId: user.id }, { user: { email: { equals: user.email, mode: "insensitive" } } }] },
    include: { items: { include: { variation: { include: { product: { select: { id: true, title: true, imageUrl: true } } } } } } },
    orderBy: { createdAt: "desc" },
  });
  const { password: _password, ...safe } = user;
  void _password;
  return { ...safe, orders };
}

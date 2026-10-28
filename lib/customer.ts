import { prisma } from "@/lib/db";

/** Şifre alanı olmadan müşteri + siparişleri. */
export async function getCustomerWithOrders(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: {
        include: { items: { include: { variation: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!user) return null;
  const { password: _password, ...safe } = user;
  void _password;
  return safe;
}

import { prisma } from "@/lib/db";

export type NotificationType = "ORDER" | "COUPON" | "QUESTION" | "SYSTEM";

interface Payload {
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
}

/** Yönetici bildirimi (userId ve userEmail boş). Hata siparişi/mesajı engellemez. */
export async function notifyAdmins(p: Payload) {
  await prisma.notification.create({ data: p }).catch((err) => console.error("[bildirim] yönetici bildirimi yazılamadı:", err));
}

/** Müşteri bildirimi: e-postadan hesap bulunursa userId de kaydedilir. */
export async function notifyCustomer(target: { userId?: string | null; email?: string | null }, p: Payload) {
  try {
    const email = target.email?.trim().toLowerCase() || null;
    let userId = target.userId ?? null;
    if (!userId && email) {
      userId = (await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }))?.id ?? null;
    }
    if (!userId && !email) return;
    await prisma.notification.create({ data: { ...p, userId, userEmail: email } });
  } catch (err) {
    console.error("[bildirim] müşteri bildirimi yazılamadı:", err);
  }
}

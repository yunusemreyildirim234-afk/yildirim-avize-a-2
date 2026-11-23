// "Teslim edildi" geçişinin müşteri e-postası. Çağıran durumu atomik yazmış (updateMany count === 1) olmalıdır; yalnız o zaman çağrılır.
import { prisma } from "@/lib/db";
import { sendDeliveredEmail } from "@/lib/email";
import { cleanGuestEmail } from "@/lib/guest-email";

/** Bu günden eski siparişe teslim e-postası gitmez (eski kayıtların toplu senkronunda posta yağmuru olmasın). */
export const DELIVERED_EMAIL_MAX_AGE_DAYS = 30;

export interface DeliveredDeps {
  email: typeof sendDeliveredEmail;
  now: () => Date;
}
const defaultDeps: DeliveredDeps = { email: sendDeliveredEmail, now: () => new Date() };

/** Saf kural: e-posta gitmeli mi? Mağazadan teslim ve 30 günden eski sipariş hariç. */
export function shouldEmailDelivered(order: { shippingType: string; createdAt: Date }, now: Date): boolean {
  if (order.shippingType === "BEYOGLU_MAGAZA_TESLIM") return false;
  return now.getTime() - order.createdAt.getTime() <= DELIVERED_EMAIL_MAX_AGE_DAYS * 86_400_000;
}

/** Teslim e-postası; her hata yutulur (akışı bozmaz). E-posta gönderildiyse true. */
export async function announceDeliveredEmail(orderId: string, deps: DeliveredDeps = defaultDeps): Promise<boolean> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        shippingType: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
        items: { select: { productTitle: true, variation: { select: { product: { select: { id: true, title: true } } } } } },
      },
    });
    if (!order || !order.user || !shouldEmailDelivered(order, deps.now())) return false;
    const to = cleanGuestEmail(order.user.email);
    if (!to) return false;
    const seen = new Set<string>();
    const items: Array<{ title: string; product?: { id: string; title: string } }> = [];
    for (const i of order.items) {
      const product = i.variation?.product;
      const title = i.productTitle || product?.title || "";
      const key = product?.id ?? title;
      if (!title || seen.has(key)) continue;
      seen.add(key);
      items.push({ title, product: product ? { id: product.id, title: product.title } : undefined });
    }
    return await deps.email({ to, name: order.user.name, orderId, items });
  } catch (e) {
    console.warn("[teslim-edildi-eposta] gönderilemedi:", (e as Error).message);
    return false;
  }
}

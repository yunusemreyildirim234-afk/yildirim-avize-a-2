import { after } from "next/server";
import { prisma } from "@/lib/db";
import { sendPriceDropEmail } from "@/lib/email";
import { hasActiveConsent } from "@/lib/marketing";
import { PRICE_DROP_COOLDOWN_MS, priceDropMessage, shouldEmailPriceDrop, shouldNotifyPriceDrop } from "@/lib/price-drop";

export interface PriceChange {
  productId: string;
  oldPrice: number;
  newPrice: number;
}

/**
 * Admin fiyat kaydından SONRA, yanıtı geciktirmeden çalıştırır (after). Hiçbir hata yöneticiye yansımaz; e-posta adresi loglanmaz.
 * Fiyat düşmediyse (artış, aynı fiyat) hiçbir sorgu yapılmaz.
 */
export function schedulePriceDrops(changes: PriceChange[]) {
  const drops = changes.filter((c) => c.oldPrice - c.newPrice >= 0.01);
  if (drops.length === 0) return;
  try {
    after(async () => {
      for (const d of drops) await notifyPriceDrop(d).catch((e) => console.error("[fiyat-dusus] işlenemedi:", (e as Error).message));
    });
  } catch (e) {
    console.error("[fiyat-dusus] zamanlanamadı:", (e as Error).message);
  }
}

/** Ürünü favorileyen giriş yapmış üyelere zil bildirimi; açık onayı olanlara (en çok 50 alıcıda) e-posta. */
export async function notifyPriceDrop({ productId, oldPrice, newPrice }: PriceChange) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { title: true, active: true } });
  if (!product?.active) return;
  const favs = await prisma.favorite.findMany({ where: { productId }, select: { userId: true, user: { select: { name: true, email: true } } } });
  if (favs.length === 0) return;

  const link = `/urun/${productId}`;
  const now = new Date();
  const recent = await prisma.notification.findMany({
    where: { type: "PRICE_DROP", link, userId: { in: favs.map((f) => f.userId) }, createdAt: { gte: new Date(now.getTime() - PRICE_DROP_COOLDOWN_MS) } },
    select: { userId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const last = new Map<string, Date>();
  for (const r of recent) if (r.userId && !last.has(r.userId)) last.set(r.userId, r.createdAt);

  const targets = favs.filter((f) => shouldNotifyPriceDrop(oldPrice, newPrice, last.get(f.userId) ?? null, now));
  if (targets.length === 0) return;

  const message = priceDropMessage(product.title, oldPrice, newPrice);
  await prisma.notification.createMany({
    data: targets.map((t) => ({ userId: t.userId, userEmail: t.user.email.toLowerCase(), title: "Favorinizde fiyat düştü", message, type: "PRICE_DROP", link })),
  });

  for (const t of targets) {
    const consent = await hasActiveConsent(t.user.email);
    if (!shouldEmailPriceDrop({ notify: true, consent, recipientCount: targets.length })) continue;
    await sendPriceDropEmail({ to: t.user.email, name: t.user.name, productId, title: product.title, oldPrice, newPrice }).catch(() => false);
  }
}

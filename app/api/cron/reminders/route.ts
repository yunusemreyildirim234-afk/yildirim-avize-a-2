import { cleanGuestEmail } from "@/lib/guest-email";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendAbandonedCartEmail, sendCartReminderEmail, sendReceiptReminderEmail } from "@/lib/email";
import { buildCampaignFooter, hasActiveConsent } from "@/lib/marketing";
import { SHOWCASE_COUPON_CODE } from "@/lib/site";
import { couponValueLabel, loadShowcaseCoupon } from "@/lib/showcase";

const HOUR = 60 * 60 * 1000;

// Vercel Cron her çağrıda "Authorization: Bearer $CRON_SECRET" gönderir. CRON_SECRET tanımlı değilse uç nokta kapalıdır.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const now = Date.now();
  let abandoned = 0;
  let receipts = 0;

  // 1) Terk edilmiş ödeme denemeleri: 2 saati geçmiş, son 7 gün
  const carts = await prisma.order.findMany({
    where: {
      status: "AWAITING_PAYMENT",
      abandonedEmailSent: false,
      createdAt: { lt: new Date(now - 2 * HOUR), gt: new Date(now - 7 * 24 * HOUR) },
    },
    include: { user: true, items: { include: { variation: { include: { product: { select: { title: true } } } } } } },
    take: 50,
  });
  // Vitrin kuponu geçerli değilse (pasif, süresi dolmuş, limit dolu, kişiye/ürüne özel) onaylı kişiye de sade hatırlatma gider
  const showcase = carts.length > 0 ? await loadShowcaseCoupon().catch(() => null) : null;
  for (const o of carts) {
    // Önce işaretle: aynı mail ikinci kez gitmesin
    const claimed = await prisma.order.updateMany({ where: { id: o.id, abandonedEmailSent: false }, data: { abandonedEmailSent: true } });
    if (claimed.count === 0) continue;
    const to = cleanGuestEmail(o.user.email);
    const items = o.items.map((i) => ({ title: i.variation.product.title, quantity: i.quantity }));
    // Ticari ileti onayı kontrolü (hata/tablo yoksa "onay yok" sayılır): onaylıya kampanya, diğerlerine indirimsiz sade hatırlatma
    const footerHtml = showcase && (await hasActiveConsent(to)) ? await buildCampaignFooter(to) : null;
    const ok = await (footerHtml && showcase
      ? sendAbandonedCartEmail({ to, name: o.user.name, orderId: o.id, couponCode: SHOWCASE_COUPON_CODE, discountLabel: couponValueLabel(showcase), items, footerHtml })
      : sendCartReminderEmail({ to, name: o.user.name, items })
    ).catch(() => false);
    if (ok) abandoned++;
    else await prisma.order.update({ where: { id: o.id }, data: { abandonedEmailSent: false } });
  }

  // 2) Havale dekont hatırlatması: 3 saati geçmiş, dekont yok
  const pending = await prisma.order.findMany({
    where: {
      status: "PENDING_NEW",
      receiptReminderSent: false,
      receiptUrl: null,
      createdAt: { lt: new Date(now - 3 * HOUR), gt: new Date(now - 14 * 24 * HOUR) },
    },
    include: { user: true },
    take: 50,
  });
  for (const o of pending) {
    const claimed = await prisma.order.updateMany({ where: { id: o.id, receiptReminderSent: false }, data: { receiptReminderSent: true } });
    if (claimed.count === 0) continue;
    const ok = await sendReceiptReminderEmail({ to: cleanGuestEmail(o.user.email), name: o.user.name, orderId: o.id }).catch(() => false);
    if (ok) receipts++;
    else await prisma.order.update({ where: { id: o.id }, data: { receiptReminderSent: false } });
  }

  return NextResponse.json({ success: true, abandoned, receipts });
}

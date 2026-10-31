import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { finalizeOrder } from "@/lib/orders";
import { getPaytrToken } from "@/lib/paytr";
import { computeTotals, couponDiscountFor, SHIPPING_LABELS } from "@/lib/pricing";
import { releaseCoupon, reserveCoupon, validateCoupon } from "@/lib/coupons";

interface CartLine {
  variationId: string;
  quantity: number;
}

function clientIp(req: Request) {
  const raw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
  const ip = raw.replace(/^::ffff:/, "");
  // PayTR yerel/geçersiz IP'leri reddedebilir; geliştirme ortamında genel bir IP kullanılır
  return !ip || ip === "::1" || ip.startsWith("127.") ? "88.255.0.1" : ip;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, address, buyerStateId, buyerCityId, buyerStateName, buyerCityName, shippingType, couponCode } =
      body;
    const paymentMethod: "CREDIT_CARD" | "BANK_TRANSFER" = body.paymentMethod === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CREDIT_CARD";
    const items: CartLine[] = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) return NextResponse.json({ error: "Sepetiniz boş olamaz" }, { status: 400 });
    if (!email || !name || !phone || !address) {
      return NextResponse.json({ error: "Ad, e-posta, telefon ve adres zorunludur." }, { status: 400 });
    }
    if (!(shippingType in SHIPPING_LABELS)) {
      return NextResponse.json({ error: "Geçersiz teslimat yöntemi." }, { status: 400 });
    }

    // 1. Fiyatlar istemciden değil veritabanından hesaplanır
    const orderLines = [];
    for (const item of items) {
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const variation = await prisma.productVariation.findUnique({
        where: { id: item.variationId },
        include: { product: true },
      });
      if (!variation || !variation.product.active) {
        return NextResponse.json({ error: "Sepetinizdeki bir ürün artık satışta değil. Lütfen sepeti yenileyin." }, { status: 400 });
      }
      if (variation.stock < quantity) {
        return NextResponse.json({ error: `"${variation.product.title}" için yeterli stok yok.` }, { status: 400 });
      }
      orderLines.push({ variation, quantity, unitPrice: variation.product.basePrice + variation.extraPrice });
    }

    const itemsTotal = orderLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    // Kupon: kişiye/ürüne özel şartlar ve kullanım limiti sunucuda doğrulanır
    let couponDiscount = 0;
    let appliedCouponCode: string | null = null;
    if (typeof couponCode === "string" && couponCode.trim()) {
      const check = await validateCoupon({
        code: couponCode,
        email: String(email).toLowerCase(),
        lines: orderLines.map((l) => ({ productId: l.variation.productId, lineTotal: l.unitPrice * l.quantity })),
      });
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
      couponDiscount = couponDiscountFor(
        check.rule,
        orderLines.map((l) => ({ productId: l.variation.productId, lineTotal: l.unitPrice * l.quantity }))
      );
      appliedCouponCode = check.rule.code;
    }
    const totals = computeTotals({ itemsTotal, shippingType, couponDiscount, paymentMethod });

    // 2. Müşteriyi bul veya oluştur
    const user =
      (await prisma.user.findUnique({ where: { email } })) ??
      (await prisma.user.create({ data: { name, email, password: "guest_checkout", role: "USER" } }));

    // 3. Siparişi kaydet (kartlı ödemede ödeme onayına kadar AWAITING_PAYMENT)
    const itemRows = orderLines.map((l) => ({ variationId: l.variation.id, quantity: l.quantity, unitPrice: l.unitPrice }));
    const totalQty = orderLines.reduce((sum, l) => sum + l.quantity, 0);
    // Kupon hakkı rezervasyonu ve sipariş kaydı tek işlemde: limit doluysa sipariş hiç oluşmaz
    class CouponLimitError extends Error {}
    let order;
    try {
      order = await prisma.$transaction(async (tx) => {
        if (appliedCouponCode && !(await reserveCoupon(tx, appliedCouponCode))) throw new CouponLimitError();
        return tx.order.create({
      data: {
        userId: user.id,
        totalAmount: totals.total,
        shippingType,
        paymentMethod,
        couponCode: appliedCouponCode,
        status: paymentMethod === "CREDIT_CARD" ? "AWAITING_PAYMENT" : "PENDING_NEW",
        phone,
        address,
        buyerStateId: buyerStateId ? Number(buyerStateId) : 34,
        buyerCityId: buyerCityId ? Number(buyerCityId) : 425,
        buyerStateName: buyerStateName || "İSTANBUL",
        buyerCityName: buyerCityName || "BEYOĞLU",
        packageDesi: Math.max(3, totalQty * 3),
        items: {
          create: itemRows,
        },
      },
        });
      });
    } catch (err) {
      if (err instanceof CouponLimitError) {
        return NextResponse.json({ error: "Bu kuponun kullanım hakkı dolmuştur veya kupon artık geçerli değil." }, { status: 400 });
      }
      throw err;
    }

    // 4a. Havale/EFT: sipariş hemen onaylanır
    if (paymentMethod === "BANK_TRANSFER") {
      await finalizeOrder(order.id);
      return NextResponse.json({ success: true, orderId: order.id });
    }

    // 4b. Kartlı ödeme: PayTR iFrame token'ı al
    try {
      const basket = orderLines.map((l) => ({
        name: `${l.variation.product.title} - ${l.variation.variationValue}`,
        price: l.unitPrice,
        quantity: l.quantity,
      }));
      if (totals.shipping > 0) basket.push({ name: "Kargo", price: totals.shipping, quantity: 1 });

      const token = await getPaytrToken({
        orderId: order.id,
        email,
        amountTl: totals.total,
        userIp: clientIp(req),
        userName: name,
        userAddress: address,
        userPhone: phone,
        basket,
      });
      return NextResponse.json({ success: true, orderId: order.id, paytrToken: token });
    } catch (err) {
      await prisma.order.update({ where: { id: order.id }, data: { status: "PAYMENT_FAILED" } });
      await releaseCoupon(appliedCouponCode).catch(() => {});
      return NextResponse.json({ error: (err as Error).message }, { status: 502 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

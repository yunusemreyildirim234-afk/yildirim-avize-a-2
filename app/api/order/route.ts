import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { finalizeOrder } from "@/lib/orders";
import { getPaytrToken } from "@/lib/paytr";
import { computeTotals } from "@/lib/pricing";

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
    if (shippingType !== "BEYOGLU_MAGAZA_TESLIM" && shippingType !== "STANDART_KARGO") {
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
    const totals = computeTotals({ itemsTotal, shippingType, couponCode, paymentMethod });

    // 2. Müşteriyi bul veya oluştur
    const user =
      (await prisma.user.findUnique({ where: { email } })) ??
      (await prisma.user.create({ data: { name, email, password: "guest_checkout", role: "USER" } }));

    // 3. Siparişi kaydet (kartlı ödemede ödeme onayına kadar AWAITING_PAYMENT)
    const totalQty = orderLines.reduce((sum, l) => sum + l.quantity, 0);
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        totalAmount: totals.total,
        shippingType,
        status: paymentMethod === "CREDIT_CARD" ? "AWAITING_PAYMENT" : "PENDING_NEW",
        phone,
        address,
        buyerStateId: buyerStateId ? Number(buyerStateId) : 34,
        buyerCityId: buyerCityId ? Number(buyerCityId) : 425,
        buyerStateName: buyerStateName || "İSTANBUL",
        buyerCityName: buyerCityName || "BEYOĞLU",
        packageDesi: Math.max(3, totalQty * 3),
        items: {
          create: orderLines.map((l) => ({ variationId: l.variation.id, quantity: l.quantity, unitPrice: l.unitPrice })),
        },
      },
    });

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
      return NextResponse.json({ error: (err as Error).message }, { status: 502 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

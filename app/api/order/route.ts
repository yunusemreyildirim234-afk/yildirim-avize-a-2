import { NextResponse } from "next/server";
import { serverError, badRequest } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { rateLimit, requestIp, tooMany } from "@/lib/rate-limit";
import { isValidPhone, PHONE_ERROR } from "@/lib/phone";
import { bankPendingLimitReached, finalizeOrder, planPendingSwap, releaseStaleReservations, restoreOrderStock, type PendingSwap } from "@/lib/orders";
import { swapAndCreate, type SwapTx } from "@/lib/order-swap";
import { getPaytrToken } from "@/lib/paytr";
import { SHIPPING_LABELS } from "@/lib/pricing";
import { getSessionUserId } from "@/lib/account";
import { EMAIL_RE, invoiceError, shippingFormError } from "@/lib/validation";
import { bulkTiersOf } from "@/lib/bulk-pricing";
import { isShort, mergeByVariation } from "@/lib/stock-rules";
import { priceCart } from "@/lib/cart-pricing";
import { isPurchasablePrice, priceUnavailableMessage } from "@/lib/purchasable";
import { releaseCoupon, reserveCouponLocked, validateCoupon } from "@/lib/coupons";
import { reserveLines, StockShortError } from "@/lib/stock-reserve";
import { BANK_PENDING_LIMIT_ERROR, PENDING_LIMIT_ERROR } from "@/lib/pending-orders";
import { bestEffort, createOrFindGuest } from "@/lib/best-effort";
import { recordConsent } from "@/lib/marketing";
import { revalidateStorefrontSafe } from "@/lib/revalidate";

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
  const rl = rateLimit(req, "order", 5, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter, "Kısa sürede çok fazla sipariş denemesi yaptınız. Lütfen daha sonra tekrar deneyin.");
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return badRequest();
    }
    if (!body || typeof body !== "object") return badRequest();
    const { name, email, phone, address, buyerStateId, buyerCityId, buyerStateName, buyerCityName, shippingType, couponCode } =
      body;
    const paymentMethod: "CREDIT_CARD" | "BANK_TRANSFER" = body.paymentMethod === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CREDIT_CARD";
    const items: CartLine[] = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) return NextResponse.json({ error: "Sepetiniz boş olamaz" }, { status: 400 });
    if (!email || !name || !phone || !address) {
      return NextResponse.json({ error: "Ad, e-posta, telefon ve adres zorunludur." }, { status: 400 });
    }
    // Girdi doğrulama (tip ve uzunluk sınırları)
    if (items.length > 50) return NextResponse.json({ error: "Sepette en fazla 50 kalem olabilir." }, { status: 400 });
    if (items.some((i) => !i || typeof i.variationId !== "string" || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 100)) {
      return NextResponse.json({ error: "Sepetteki ürün adetleri geçersiz." }, { status: 400 });
    }
    if (typeof name !== "string" || name.length > 120 || typeof phone !== "string" || phone.length > 30 || typeof address !== "string" || address.length > 500) {
      return NextResponse.json({ error: "Ad, telefon veya adres geçersiz ya da çok uzun." }, { status: 400 });
    }
    if (typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Geçerli bir e-posta adresi giriniz." }, { status: 400 });
    }
    if (!isValidPhone(phone)) return NextResponse.json({ error: PHONE_ERROR }, { status: 400 });
    if (buyerStateId !== undefined && buyerStateId !== null && !Number.isInteger(buyerStateId)) {
      return NextResponse.json({ error: "Geçersiz il bilgisi." }, { status: 400 });
    }
    if (buyerCityId !== undefined && buyerCityId !== null && !Number.isInteger(buyerCityId)) {
      return NextResponse.json({ error: "Geçersiz ilçe bilgisi." }, { status: 400 });
    }
    if ([buyerStateName, buyerCityName].some((v) => v !== undefined && v !== null && (typeof v !== "string" || v.length > 80))) {
      return NextResponse.json({ error: "Geçersiz il/ilçe adı." }, { status: 400 });
    }
    // Yasal onaylar, fatura bilgileri ve sipariş notu
    if (body.consent !== true) {
      return NextResponse.json({ error: "Ön Bilgilendirme Koşulları ve Mesafeli Satış Sözleşmesi'ni onaylamanız gerekir." }, { status: 400 });
    }
    const invoiceType = body.invoiceType === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL";
    const taxNumber = typeof body.taxNumber === "string" ? body.taxNumber.replace(/\s/g, "").slice(0, 20) : "";
    const taxOffice = typeof body.taxOffice === "string" ? body.taxOffice.trim().slice(0, 120) : "";
    const companyTitle = typeof body.companyTitle === "string" ? body.companyTitle.trim().slice(0, 200) : "";
    const orderNote = typeof body.orderNote === "string" ? body.orderNote.trim().slice(0, 1000) : "";
    const invErr = invoiceError({ invoiceType, taxNumber, taxOffice, companyTitle });
    if (invErr) return NextResponse.json({ error: invErr }, { status: 400 });
    if (!(shippingType in SHIPPING_LABELS)) {
      return NextResponse.json({ error: "Geçersiz teslimat yöntemi." }, { status: 400 });
    }
    // Teslimat formu: ad soyad, il, ilçe ve açık adres sunucuda da zorunlu (mağazadan teslimde yalnızca ad)
    const formErr = shippingFormError({ name, address, stateId: buyerStateId, cityId: buyerCityId, isPickup: shippingType === "BEYOGLU_MAGAZA_TESLIM" });
    if (formErr) return NextResponse.json({ error: formErr.message, field: formErr.field }, { status: 400 });

    // Süresi (RESERVATION_HOLD_MINUTES, lib/stock-rules.ts) dolmuş bekleyen kartlı rezervasyonlar tembel serbest bırakılır (cron günde bir kez çalışır)
    await releaseStaleReservations().catch((e) => console.error("[siparis] süresi dolan rezervasyonlar serbest bırakılamadı:", (e as Error).message));
    // Kartlı "geri dön, tekrar dene": müşterinin kendi bekleyen kartlı siparişi burada KAPATILMAZ, yalnızca belirlenir (oturumdaki kullanıcının
    // siparişleri ya da tarayıcının bildiği previousOrderId; e-posta tek başına yetmez). Kapatma, yeni sipariş kaydıyla AYNI transaction içindedir
    // (lib/order-swap.ts): bu istek stok/kupon hatasıyla reddedilirse eski sipariş ödeme bekler hâlde kalır (açık ödeme sayfası geçerliliğini korur).
    // Aynı telefon/e-posta için bekleyen sınırı doluysa yeni sipariş açılmaz.
    let swap: PendingSwap = { blocked: false, swapIds: [], heldStock: new Map(), heldCoupons: [] };
    if (paymentMethod === "CREDIT_CARD") {
      swap = await planPendingSwap({ email: String(email), phone, sessionUserId: await getSessionUserId(), previousOrderId: body.previousOrderId }).catch((e) => {
        console.error("[siparis] bekleyen sipariş denetimi başarısız:", (e as Error).message);
        return swap;
      });
      if (swap.blocked) return NextResponse.json({ error: PENDING_LIMIT_ERROR }, { status: 429 });
    }

    // 1. Fiyatlar istemciden değil veritabanından hesaplanır
    const wantedByVariation = new Map(mergeByVariation(items.map((i) => ({ variationId: i.variationId, quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)) }))).map((l) => [l.variationId, l.quantity]));
    const orderLines = [];
    for (const item of items) {
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const loadVariation = () => prisma.productVariation.findUnique({ where: { id: item.variationId }, include: { product: true } });
      let variation = await loadVariation();
      if (!variation || !variation.product.active) {
        return NextResponse.json({ error: "Sepetinizdeki bir ürün artık satışta değil. Lütfen sepeti yenileyin." }, { status: 400 });
      }
      if (!isPurchasablePrice(variation.product.basePrice + variation.extraPrice)) {
        return NextResponse.json({ error: priceUnavailableMessage(variation.product.title) }, { status: 400 });
      }
      // Aynı varyasyon birden fazla satırda gelebilir: toplam adet stokla karşılaştırılır
      const wanted = wantedByVariation.get(item.variationId) ?? quantity;
      // Değiştirilecek eski siparişin ayırdığı stok aynı transaction içinde serbest kalacağı için müşterinin kullanılabilir stoğuna eklenir (son ürün senaryosu)
      const held = swap.heldStock.get(item.variationId) ?? 0;
      // Kartlı sipariş: stok yetersiz görünüyorsa 45 dk'yı geçmiş ödeme bekleyen rezervasyonlar önce serbest bırakılır, kontrol bir kez daha yapılır
      if (isShort(variation.stock + held, wanted) && paymentMethod === "CREDIT_CARD" && (await releaseStaleReservations([...wantedByVariation.keys()]))) {
        variation = (await loadVariation()) ?? variation;
      }
      if (isShort(variation.stock + held, wanted)) {
        return NextResponse.json({ error: `"${variation.product.title}" için stok yetersiz.` }, { status: 400 });
      }
      orderLines.push({ variation, quantity, unitPrice: variation.product.basePrice + variation.extraPrice });
    }

    // Tek hesaplama (lib/cart-pricing.ts): kademe aynı ürünün tüm renklerinin toplam adedine göre, kupon yalnızca uygun kalemlere,
    // mağaza/Havale indirimi ürünün oranına göre. Sepet ve /api/cart/quote aynı fonksiyonu çağırır.
    const priceLines = orderLines.map((l) => ({
      variationId: l.variation.id,
      productId: l.variation.productId,
      price: l.variation.product.basePrice + l.variation.extraPrice,
      quantity: l.quantity,
      tiers: bulkTiersOf(l.variation.product),
      couponAllowed: l.variation.product.couponAllowed,
      pickupPct: l.variation.product.pickupDiscountPct,
      transferPct: l.variation.product.transferDiscountPct,
    }));
    const cap = (await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { maxTotalDiscountPct: true } }))?.maxTotalDiscountPct ?? null;
    let priced = priceCart({ lines: priceLines, maxTotalDiscountPct: cap, shippingType, paymentMethod });
    // Kupon: kişiye/ürüne özel şartlar ve kullanım limiti sunucuda doğrulanır
    let appliedCouponCode: string | null = null;
    if (typeof couponCode === "string" && couponCode.trim()) {
      const check = await validateCoupon({
        code: couponCode,
        email: String(email).toLowerCase(),
        userId: await getSessionUserId(),
        lines: priced.lines.map((l) => ({ productId: l.productId, lineTotal: l.lineTotal })),
        replacing: { orderIds: swap.swapIds, couponCodes: swap.heldCoupons },
      });
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
      priced = priceCart({ lines: priceLines, maxTotalDiscountPct: cap, shippingType, paymentMethod, coupon: check.rule });
      if (priced.couponError) return NextResponse.json({ error: priced.couponError }, { status: 400 });
      appliedCouponCode = check.rule.code;
    }
    orderLines.forEach((l, i) => {
      l.unitPrice = priced.lines[i].unitPrice;
    });
    const totals = priced;

    // Havale: aynı e-posta/telefon için bekleyen sipariş sınırı (ürün ve kupon hataları önce gösterilir)
    if (paymentMethod === "BANK_TRANSFER") {
      const blocked = await bankPendingLimitReached({ email: String(email), phone }).catch((e) => {
        console.error("[siparis] bekleyen havale denetimi başarısız:", (e as Error).message);
        return false;
      });
      if (blocked) return NextResponse.json({ error: BANK_PENDING_LIMIT_ERROR }, { status: 429 });
    }

    // 2. Müşteriyi bul veya oluştur
    // Sipariş yalnızca geçerli bir oturum varsa mevcut hesaba bağlanır; misafir, e-postayla başkasının hesabına bağlanamaz
    const sessionUserId = await getSessionUserId();
    const normalizedEmail = String(email).trim().toLowerCase();
    let user = sessionUserId ? await prisma.user.findUnique({ where: { id: sessionUserId } }) : null;
    if (!user) {
      const existing = await prisma.user.findFirst({ where: { email: { equals: normalizedEmail, mode: "insensitive" } } });
      if (existing && existing.password === "guest_checkout") {
        user = existing;
      } else {
        // E-posta kayıtlı bir hesaba aitse sipariş o hesaba BAĞLANMAZ ve hata verilmez (hesap varlığı sızdırılmaz):
        // ayrı bir misafir kaydı açılır. "+misafir" etiketli adres aynı gelen kutusuna ulaşır.
        const [local, domain] = normalizedEmail.split("@");
        const guestEmail = existing ? `${local}+misafir${Math.random().toString(36).slice(2, 8)}@${domain}` : normalizedEmail;
        // Eşzamanlı iki istek aynı yeni e-postayı oluşturmaya çalışırsa (P2002) kayıt yeniden bulunur
        user = await createOrFindGuest(
          {
            create: () => prisma.user.create({ data: { name, email: guestEmail, password: "guest_checkout", role: "USER" } }),
            find: () => prisma.user.findFirst({ where: { email: { equals: guestEmail, mode: "insensitive" } } }),
          },
          "guest_checkout"
        );
      }
    }

    // 3. Siparişi kaydet (kartlı ödemede ödeme onayına kadar AWAITING_PAYMENT)
    const itemRows = orderLines.map((l) => ({ variationId: l.variation.id, quantity: l.quantity, unitPrice: l.unitPrice }));
    const totalQty = orderLines.reduce((sum, l) => sum + l.quantity, 0);
    // Kupon hakkı rezervasyonu ve sipariş kaydı tek işlemde: limit doluysa sipariş hiç oluşmaz
    class CouponLimitError extends Error {}
    class CouponUserLimitError extends Error {}
    const reservedLines = mergeByVariation(itemRows);
    const createOrderTx = () =>
      prisma.$transaction(async (tx) =>
        // Önce müşterinin değiştirilecek eski bekleyen siparişi kapatılır (stok + kupon iade), sonra yenisi oluşturulur; aşağıdaki adımlardan biri
        // hata verirse transaction geri alınır ve eski sipariş hiç kapanmamış olur
        swapAndCreate(tx as unknown as SwapTx, swap.swapIds, (code) => releaseCoupon(code, tx), async () => {
        if (appliedCouponCode) {
          // Kupon satırı kilitlenir; kişi başı limit sayımı ve hak rezervasyonu kilit altında yapılır (eşzamanlı çift kullanım engellenir)
          const r = await reserveCouponLocked(tx, appliedCouponCode, { email: normalizedEmail, userId: sessionUserId });
          if (r === "LIMIT") throw new CouponLimitError();
          if (r === "USER_LIMIT") throw new CouponUserLimitError();
        }
        // Kartlı ve Havale: stok şimdi ayrılır (koşullu atomik UPDATE, stock >= adet) ve Order.stockDeducted ile işaretlenir; yetmezse sipariş açılmaz
        await reserveLines(reservedLines, async (variationId, quantity) => (await tx.$executeRaw`UPDATE "ProductVariation" SET "stock" = "stock" - ${quantity} WHERE "id" = ${variationId} AND "stock" >= ${quantity}`) > 0);
        return tx.order.create({
      data: {
        stockDeducted: true,
        userId: user.id,
        totalAmount: totals.total,
        shippingType,
        paymentMethod,
        couponCode: appliedCouponCode,
        orderNote: orderNote || null,
        invoiceType,
        taxNumber: taxNumber || null,
        taxOffice: invoiceType === "CORPORATE" ? taxOffice : null,
        companyTitle: invoiceType === "CORPORATE" ? companyTitle : null,
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
        }), { maxWait: 5000, timeout: 10000 });
    let order;
    try {
      try {
        order = await createOrderTx();
      } catch (err) {
        // Eşzamanlı bir sipariş son stoğu aldıysa: bayat rezervasyonlar bırakılır ve bir kez daha denenir
        if (!(err instanceof StockShortError) || !(await releaseStaleReservations(reservedLines.map((l) => l.variationId)))) throw err;
        order = await createOrderTx();
      }
    } catch (err) {
      if (err instanceof CouponLimitError) {
        return NextResponse.json({ error: "Bu kuponun kullanım hakkı dolmuştur veya kupon artık geçerli değil." }, { status: 400 });
      }
      if (err instanceof CouponUserLimitError) {
        return NextResponse.json({ error: "Bu kuponu daha önce kullandınız." }, { status: 400 });
      }
      if (err instanceof StockShortError) {
        const l = orderLines.find((x) => x.variation.id === err.variationId);
        return NextResponse.json({ error: `"${l?.variation.product.title ?? "Ürün"}" için stok yetersiz.` }, { status: 400 });
      }
      throw err;
    }
    // Sipariş kaydı ve stok rezervasyonu commit edildi: vitrin önbelleği yenilenir (en iyi çaba; hata siparişi bozmaz)
    revalidateStorefrontSafe();

    // Kampanya e-postası onayı: yalnızca açık true; sipariş oluştuktan sonra, best-effort. Abonelikten çıkmış kayıt yeniden açılmaz.
    if (body.marketingOptIn === true) {
      try {
        await recordConsent({ email: normalizedEmail, ip: requestIp(req), userAgent: req.headers.get("user-agent"), source: "siparis", reactivate: false });
      } catch (e) {
        console.error("[siparis] kampanya onayı kaydedilemedi:", (e as Error).message);
      }
    }

    // 4a. Havale/EFT: sipariş hemen onaylanır
    if (paymentMethod === "BANK_TRANSFER") {
      // Stok sipariş işleminde ayrıldı, burada bildirimler gider; sipariş yönetici ödemeyi onaylayana kadar PENDING_NEW kalır
      // Sipariş kaydedildi: bildirim adımı hata verirse müşteri 500 görüp tekrar sipariş vermesin
      await bestEffort("order/finalize", () => finalizeOrder(order.id, { awaitPayment: true }));
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
      await restoreOrderStock(order.id).catch((e) => console.error("[siparis] stok iadesi başarısız (cron süpürür):", (e as Error).message));
      await releaseCoupon(appliedCouponCode).catch(() => {});
      return serverError("order/paytr", err, "Ödeme başlatılamadı. Lütfen tekrar deneyin.", 502);
    }
  } catch (error) {
    return serverError("order", error, "Siparişiniz oluşturulamadı. Lütfen tekrar deneyin.");
  }
}

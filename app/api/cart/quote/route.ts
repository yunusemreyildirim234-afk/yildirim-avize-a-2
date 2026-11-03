import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { bulkTiersOf } from "@/lib/bulk-pricing";
import { priceCart } from "@/lib/cart-pricing";
import { SHIPPING_LABELS, type CouponRule } from "@/lib/pricing";
import { validateCoupon } from "@/lib/coupons";

// SALT OKUNUR fiyat teklifi: sepet kalemleri için güncel birim fiyat/kademe/kurallar/stok ve toplamları döndürür.
// Sipariş oluşturmaz, stok düşmez, kupon hakkı rezerve etmez. Hesap /api/order ile AYNI fonksiyonla yapılır (lib/cart-pricing.ts).
export async function POST(req: Request) {
  const rl = rateLimit(req, "cart-quote", 120, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);

  const body = await req.json().catch(() => ({}));
  const raw: { variationId?: unknown; qty?: unknown }[] = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  const wanted = new Map<string, number>();
  for (const r of raw) {
    if (typeof r.variationId !== "string") continue;
    wanted.set(r.variationId, (wanted.get(r.variationId) ?? 0) + Math.min(99, Math.max(1, Math.floor(Number(r.qty) || 1))));
  }
  const shippingType = typeof body.deliveryMethod === "string" && body.deliveryMethod in SHIPPING_LABELS ? body.deliveryMethod : "STANDART_KARGO";
  const paymentMethod: "CREDIT_CARD" | "BANK_TRANSFER" = body.paymentMethod === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CREDIT_CARD";

  const variations = await prisma.productVariation.findMany({
    where: { id: { in: [...wanted.keys()] } },
    select: {
      id: true, productId: true, variationValue: true, extraPrice: true, stock: true,
      product: { select: { title: true, active: true, basePrice: true, bulkTiers: true, couponAllowed: true, pickupDiscountPct: true, transferDiscountPct: true } },
    },
  });
  const byId = new Map(variations.map((v) => [v.id, v]));

  const missing: { variationId: string; available: false }[] = [];
  const usable = [...wanted.entries()].flatMap(([variationId, quantity]) => {
    const v = byId.get(variationId);
    if (!v || !v.product.active) {
      missing.push({ variationId, available: false });
      return [];
    }
    return [{ v, quantity }];
  });
  const priceLines = usable.map(({ v, quantity }) => ({
    variationId: v.id,
    productId: v.productId,
    price: v.product.basePrice + v.extraPrice,
    quantity,
    tiers: bulkTiersOf(v.product),
    couponAllowed: v.product.couponAllowed,
    pickupPct: v.product.pickupDiscountPct,
    transferPct: v.product.transferDiscountPct,
  }));

  // Kupon (yalnızca doğrulama ve hesap; rezervasyon yok)
  const cap = (await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { maxTotalDiscountPct: true } }))?.maxTotalDiscountPct ?? null;
  let priced = priceCart({ lines: priceLines, maxTotalDiscountPct: cap, shippingType, paymentMethod });
  let coupon: { ok: boolean; rule?: CouponRule; error?: string } | null = null;
  const code = typeof body.coupon === "string" ? body.coupon.trim() : "";
  if (code) {
    const check = await validateCoupon({
      code,
      email: typeof body.email === "string" ? body.email : null,
      lines: priced.lines.map((l) => ({ productId: l.productId, lineTotal: l.lineTotal })),
    });
    if (check.ok) {
      const withCoupon = priceCart({ lines: priceLines, maxTotalDiscountPct: cap, shippingType, paymentMethod, coupon: check.rule });
      if (withCoupon.couponError) coupon = { ok: false, error: withCoupon.couponError };
      else {
        priced = withCoupon;
        coupon = { ok: true, rule: check.rule };
      }
    } else coupon = { ok: false, error: check.error };
  }

  const lines = [
    ...priced.lines.map((l, i) => ({
      variationId: l.variationId,
      productId: l.productId,
      title: usable[i].v.product.title,
      variationName: usable[i].v.variationValue,
      quantity: l.quantity,
      available: true as const,
      stockShort: usable[i].v.stock < l.quantity,
      stock: usable[i].v.stock,
      price: l.price,
      bulk: l.tiers,
      tierQty: l.tierQty,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      rules: { couponAllowed: l.couponAllowed, pickupPct: l.pickupPct, transferPct: l.transferPct },
    })),
    ...missing,
  ];
  const { itemsTotal, shipping, couponDiscount, pickupDiscount, bankDiscount, total } = priced;
  return NextResponse.json(
    { lines, itemsTotal, totals: { itemsTotal, shipping, couponDiscount, pickupDiscount, bankDiscount, total }, coupon },
    { headers: { "Cache-Control": "no-store" } }
  );
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { bulkTiersOf, unitPriceFor } from "@/lib/bulk-pricing";
import { computeTotals, couponDiscountFor, SHIPPING_LABELS, type CouponRule } from "@/lib/pricing";
import { validateCoupon } from "@/lib/coupons";

// SALT OKUNUR fiyat teklifi: sepet kalemleri için güncel birim fiyat/kademe/stok ve toplamları döndürür.
// Sipariş oluşturmaz, stok düşmez, kupon hakkı rezerve etmez. Hesap /api/order ile aynı fonksiyonlarla yapılır
// (unitPriceFor + lib/pricing.ts); satırlar /api/order gibi YUVARLANMAZ (birim fiyat × adet toplamı).
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
    select: { id: true, productId: true, variationValue: true, extraPrice: true, stock: true, product: { select: { title: true, active: true, basePrice: true, bulkTiers: true } } },
  });
  const byId = new Map(variations.map((v) => [v.id, v]));

  const lines = [...wanted.entries()].map(([variationId, quantity]) => {
    const v = byId.get(variationId);
    if (!v || !v.product.active) return { variationId, quantity, available: false as const };
    const tiers = bulkTiersOf(v.product);
    const price = v.product.basePrice + v.extraPrice;
    const unitPrice = unitPriceFor(price, quantity, tiers);
    return {
      variationId,
      productId: v.productId,
      title: v.product.title,
      variationName: v.variationValue,
      quantity,
      available: true as const,
      stockShort: v.stock < quantity,
      stock: v.stock,
      price,
      bulk: tiers,
      unitPrice,
      lineTotal: unitPrice * quantity,
    };
  });
  const ok = lines.filter((l): l is Extract<(typeof lines)[number], { available: true }> => l.available);
  const itemsTotal = ok.reduce((sum, l) => sum + l.lineTotal, 0);

  // Kupon (yalnızca doğrulama ve hesap; rezervasyon yok)
  let coupon: { ok: boolean; rule?: CouponRule; error?: string } | null = null;
  let couponDiscount = 0;
  const code = typeof body.coupon === "string" ? body.coupon.trim() : "";
  if (code) {
    const priceLines = ok.map((l) => ({ productId: l.productId, lineTotal: l.lineTotal }));
    const check = await validateCoupon({ code, email: typeof body.email === "string" ? body.email : null, lines: priceLines });
    if (check.ok) {
      coupon = { ok: true, rule: check.rule };
      couponDiscount = couponDiscountFor(check.rule, priceLines);
    } else coupon = { ok: false, error: check.error };
  }

  const totals = computeTotals({ itemsTotal, shippingType, couponDiscount, paymentMethod });
  return NextResponse.json({ lines, itemsTotal, totals: { itemsTotal, ...totals }, coupon }, { headers: { "Cache-Control": "no-store" } });
}

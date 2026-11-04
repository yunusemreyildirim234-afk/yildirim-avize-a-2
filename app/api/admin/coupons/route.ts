import { NextResponse } from "next/server";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { expiryFromDate } from "@/lib/coupon-expiry";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { sendCampaignCouponEmail } from "@/lib/email";
import { buildCampaignFooter, hasActiveConsent } from "@/lib/marketing";
import { notifyCustomer } from "@/lib/notifications";
import { COUPON_CODE_TAKEN_ERROR, couponCodeFormatError, isShowcaseCoupon, normalizeCouponCode, renamePromoCardCodes } from "@/lib/coupon-code";
import type { Prisma } from "@/generated/prisma/client";

const MAX_FIXED_AMOUNT = 100_000;
const MAX_MIN_CART = 1_000_000;

type Terms = { expiresAt: Date | null; discountType: "PERCENT" | "FIXED"; discountPercent: number; discountAmount: number | null; minCartTotal: number | null; perUserLimit: number | null };

/** İndirim türü/tutarı, minimum sepet ve kişi başı limit doğrulaması (oluşturma ve düzenleme ortak). */
function parseTerms(body: Record<string, unknown>): Terms | { error: string } {
  const fixed = body.discountType === "FIXED";
  let discountPercent = 0;
  let discountAmount: number | null = null;
  if (fixed) {
    const amount = Number(body.discountAmount);
    if (!(Number.isFinite(amount) && amount > 0 && amount <= MAX_FIXED_AMOUNT)) {
      return { error: `TL indirim tutarı 0'dan büyük ve en fazla ${MAX_FIXED_AMOUNT.toLocaleString("tr-TR")} ₺ olmalı.` };
    }
    discountAmount = Math.round(amount * 100) / 100;
  } else {
    discountPercent = Number(body.discountPercent);
    if (!(Number.isFinite(discountPercent) && discountPercent > 0 && discountPercent < 100)) {
      return { error: "İndirim yüzdesi 0 ile 100 arasında olmalıdır (100 hariç)." };
    }
  }
  const minRaw = body.minCartTotal === undefined || body.minCartTotal === null || body.minCartTotal === "" ? 0 : Number(body.minCartTotal);
  if (!(Number.isFinite(minRaw) && minRaw >= 0 && minRaw <= MAX_MIN_CART)) return { error: "Minimum sepet tutarı 0 veya daha büyük olmalı." };
  // Bitiş tarihi (isteğe bağlı, "YYYY-MM-DD"): boş/null = süresiz; seçilen günün sonuna (TR saati) kadar geçerli
  let expiresAt: Date | null = null;
  if (typeof body.expiresAt === "string" && body.expiresAt.trim()) {
    expiresAt = expiryFromDate(body.expiresAt.trim());
    if (!expiresAt) return { error: "Bitiş tarihi geçersiz." };
  }
  return {
    expiresAt,
    discountType: fixed ? "FIXED" : "PERCENT",
    discountPercent,
    discountAmount,
    minCartTotal: minRaw > 0 ? Math.round(minRaw * 100) / 100 : null,
    perUserLimit: body.perUserOnce === true ? 1 : null,
  };
}

// Promosyon kodu yönetimi (proxy yalnızca yöneticiye açar)
async function POSTHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const code = normalizeCouponCode(body.code);
  const maxUses = Math.floor(Number(body.maxUses));
  const userEmail = typeof body.userEmail === "string" && body.userEmail.trim() ? body.userEmail.trim().toLowerCase() : null;
  const productId = typeof body.productId === "string" && body.productId ? body.productId : null;

  const formatError = couponCodeFormatError(code);
  if (formatError) return NextResponse.json({ error: formatError }, { status: 400 });
  const terms = parseTerms(body);
  if ("error" in terms) return NextResponse.json({ error: terms.error }, { status: 400 });
  const { discountPercent } = terms;
  if (!(maxUses >= 1)) return NextResponse.json({ error: "Kullanım limiti en az 1 olmalı." }, { status: 400 });
  if (await prisma.coupon.findFirst({ where: { code: { equals: code, mode: "insensitive" } }, select: { id: true } })) {
    return NextResponse.json({ error: "Bu kod zaten mevcut." }, { status: 409 });
  }
  if (productId && !(await prisma.product.findUnique({ where: { id: productId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Seçilen ürün bulunamadı." }, { status: 400 });
  }

  const coupon = await prisma.coupon.create({ data: { code, ...terms, maxUses, userEmail, productId } });
  // Kişiye özel kuponda müşteriye hesap bildirimi gider; kampanya e-postası yalnızca ticari ileti onayı olana gönderilir
  let emailSkipped = false;
  if (userEmail) {
    const customer = await prisma.user.findFirst({ where: { email: { equals: userEmail, mode: "insensitive" } }, select: { name: true } });
    await notifyCustomer(
      { email: userEmail },
      { title: "Size özel kupon tanımlandı!", message: `Size özel ${terms.discountType === "FIXED" ? `${terms.discountAmount} ₺` : `%${discountPercent}`} indirim kuponu tanımlandı! Kod: ${code}`, type: "COUPON", link: "/giris#kuponlar" }
    );
    const footerHtml = (await hasActiveConsent(userEmail)) ? await buildCampaignFooter(userEmail) : null;
    if (footerHtml) {
      await sendCampaignCouponEmail({ to: userEmail, name: customer?.name ?? "Değerli Müşterimiz", code, discountPercent, discountAmount: terms.discountAmount, footerHtml }).catch(() => false);
    } else {
      emailSkipped = true;
    }
  }

  return NextResponse.json({ success: true, coupon, emailSkipped });
}

// Pasife alma / yeniden aktifleştirme
async function PATCHHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const { id, active } = body;
  if (typeof id !== "string") return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
  // İndirim türü/tutarı, şartlar ve (isteğe bağlı) kod adı düzenlenir. Mevcut siparişler kendi kayıtlı tutarını ve kodunu korur (yalnızca yeni siparişler etkilenir).
  if (body.discountType !== undefined) {
    const terms = parseTerms(body);
    if ("error" in terms) return NextResponse.json({ error: terms.error }, { status: 400 });
    const newCode = typeof body.code === "string" ? normalizeCouponCode(body.code) : null;
    if (newCode !== null) {
      const formatError = couponCodeFormatError(newCode);
      if (formatError) return NextResponse.json({ error: formatError }, { status: 400 });
    }
    // Yeniden adlandırma + şartlar TEK transaction: kullanım sayısı (usedCount) ve diğer ayarlar korunur; vitrin bağı ve ana sayfa kartları aynı işlemde güncellenir
    try {
      const out = await prisma.$transaction(async (tx) => {
        const cur = await tx.coupon.findUnique({ where: { id } });
        if (!cur) return { status: 404, error: "Kod bulunamadı." };
        const data: Prisma.CouponUpdateInput = { ...terms };
        if (newCode && newCode !== cur.code) {
          if (await tx.coupon.findFirst({ where: { id: { not: id }, code: { equals: newCode, mode: "insensitive" } }, select: { id: true } })) {
            return { status: 409, error: COUPON_CODE_TAKEN_ERROR(newCode) };
          }
          // Siparişler kuponu kod metniyle saklar; kişi başı limit eski koda bağlı siparişlerle sayıldığı için bu durumda yeniden adlandırma engellenir
          if (terms.perUserLimit && (await tx.order.count({ where: { couponCode: cur.code } })) > 0) {
            return { status: 409, error: "Kişi başı limitli bu kodla daha önce sipariş verilmiş; limit sayımı bozulmaması için adı değiştirilemez. Yeni bir kod oluşturup bunu pasife alabilirsiniz." };
          }
          data.code = newCode;
          const cfg = await tx.siteConfig.findUnique({ where: { id: 1 }, select: { showcaseCouponId: true, homepageConfig: true } });
          if (isShowcaseCoupon(cur, cfg?.showcaseCouponId)) {
            await tx.siteConfig.upsert({ where: { id: 1 }, update: { showcaseCouponId: id }, create: { id: 1, showcaseCouponId: id } });
          }
          const cards = renamePromoCardCodes(cfg?.homepageConfig, cur.code, newCode);
          if (cards) await tx.siteConfig.update({ where: { id: 1 }, data: { homepageConfig: cards as Prisma.InputJsonValue } });
        }
        await tx.coupon.update({ where: { id }, data });
        return { status: 200 as const };
      });
      if (out.status !== 200) return NextResponse.json({ error: out.error }, { status: out.status });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002" && newCode) return NextResponse.json({ error: COUPON_CODE_TAKEN_ERROR(newCode) }, { status: 409 });
      throw e;
    }
    return NextResponse.json({ success: true });
  }
  if (typeof active !== "boolean") return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
  await prisma.coupon.update({ where: { id }, data: { active } });
  return NextResponse.json({ success: true });
}

async function DELETEHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string") return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export const POST = withStorefrontRevalidate(POSTHandler);
export const PATCH = withStorefrontRevalidate(PATCHHandler);
export const DELETE = withStorefrontRevalidate(DELETEHandler);

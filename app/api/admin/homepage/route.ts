import { NextResponse } from "next/server";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { MAX_COUNT, MAX_PINNED, SECTION_KEYS } from "@/lib/homepage-compose";
import { couponCodesOf, couponWarnings, validatePromoCards, type CouponRow } from "@/lib/promo-cards";

// Ana sayfa ayarları (yalnızca yönetici). Gövde: { featured|discounted|bestsellers: { count, pinnedIds[] }, promoCards: [...] | null }
async function PUTHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-homepage", 30, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const unknownTop = Object.keys(body).filter((k) => !(SECTION_KEYS as readonly string[]).includes(k) && k !== "promoCards");
  if (unknownTop.length) return NextResponse.json({ error: `Bilinmeyen alan: ${unknownTop[0]}` }, { status: 400 });

  const config: Record<string, { count: number; pinnedIds: string[] }> = {};
  const allPinned = new Set<string>();
  const reset: string[] = []; // null gönderilen bölümler varsayılana döner (kayıt silinir)
  for (const key of SECTION_KEYS) {
    const sec = (body as Record<string, unknown>)[key];
    if (sec === undefined) continue;
    if (sec === null) {
      reset.push(key);
      continue;
    }
    if (!sec || typeof sec !== "object" || Array.isArray(sec)) return NextResponse.json({ error: "Geçersiz bölüm ayarı." }, { status: 400 });
    const s = sec as Record<string, unknown>;
    const extra = Object.keys(s).filter((k) => k !== "count" && k !== "pinnedIds");
    if (extra.length) return NextResponse.json({ error: `Bilinmeyen alan: ${extra[0]}` }, { status: 400 });
    if (typeof s.count !== "number" || !Number.isInteger(s.count) || s.count < 1 || s.count > MAX_COUNT) {
      return NextResponse.json({ error: `Ürün sayısı 1 ile ${MAX_COUNT} arasında tam sayı olmalıdır.` }, { status: 400 });
    }
    if (!Array.isArray(s.pinnedIds) || s.pinnedIds.length > MAX_PINNED || s.pinnedIds.some((x) => typeof x !== "string")) {
      return NextResponse.json({ error: `En fazla ${MAX_PINNED} ürün sabitlenebilir.` }, { status: 400 });
    }
    const ids = s.pinnedIds as string[];
    if (new Set(ids).size !== ids.length) return NextResponse.json({ error: "Aynı ürün bir bölümde iki kez sabitlenemez." }, { status: 400 });
    ids.forEach((i) => allPinned.add(i));
    config[key] = { count: s.count, pinnedIds: ids };
  }
  // Avantaj kartları: null varsayılana döner (kayıt silinir), liste sıkı doğrulanır
  const rawCards = (body as Record<string, unknown>).promoCards;
  let cards: ReturnType<typeof validatePromoCards> | null = null;
  if (rawCards === null) reset.push("promoCards");
  else if (rawCards !== undefined) {
    cards = validatePromoCards(rawCards);
    if (!cards.ok) return NextResponse.json({ error: cards.error }, { status: 400 });
  }
  if (Object.keys(config).length === 0 && reset.length === 0 && !cards) return NextResponse.json({ error: "Kaydedilecek bölüm yok." }, { status: 400 });

  // Sabitlenen ürünler mevcut ve aktif olmalı
  if (allPinned.size) {
    const ok = await prisma.product.count({ where: { id: { in: [...allPinned] }, active: true } });
    if (ok !== allPinned.size) return NextResponse.json({ error: "Sabitlenen ürünlerden bazıları bulunamadı veya aktif değil." }, { status: 400 });
  }

  // Gönderilmeyen bölümler mevcut kayıtlı değerini korur
  const current = (await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { homepageConfig: true } }))?.homepageConfig;
  const merged: Record<string, unknown> = { ...(current && typeof current === "object" && !Array.isArray(current) ? current : {}), ...config };
  if (cards?.ok) merged.promoCards = cards.cards;
  for (const key of reset) delete merged[key];
  await prisma.siteConfig.upsert({ where: { id: 1 }, create: { id: 1, homepageConfig: merged as object }, update: { homepageConfig: merged as object } });
  // Kupon kartlarında kod geçerli değilse UYARI (kaydı engellemez)
  let warnings: string[] = [];
  if (cards?.ok) {
    const codes = couponCodesOf(cards.cards.filter((c) => c.active));
    const rows = codes.length ? await prisma.coupon.findMany({ where: { code: { in: codes } } }) : [];
    const byCode: Record<string, CouponRow | undefined> = {};
    for (const r of rows) byCode[r.code.toUpperCase()] = r;
    warnings = couponWarnings(cards.cards.filter((c) => c.active), byCode);
  }
  return NextResponse.json({ success: true, warnings });
}

export const PUT = withStorefrontRevalidate(PUTHandler);

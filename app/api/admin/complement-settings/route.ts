import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { STOREFRONT_UNCHANGED } from "@/lib/revalidate-rule";
import { DEFAULT_SUGGEST_COUNT, parseSuggestCount } from "@/lib/complements";

// Öneri kartı sayısı: boş/null = varsayılan (4), 0 = öneriler kapalı, 1-12 = kart sayısı.
async function GETHandler() {
  const denied = await adminGuard();
  if (denied) return denied;
  const cfg = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { complementSuggestCount: true } });
  return NextResponse.json({ count: cfg?.complementSuggestCount ?? null, defaultCount: DEFAULT_SUGGEST_COUNT }, STOREFRONT_UNCHANGED);
}

async function PUTHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const parsed = parseSuggestCount((body as { count?: unknown }).count);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  await prisma.siteConfig.upsert({
    where: { id: 1 },
    create: { id: 1, complementSuggestCount: parsed.value },
    update: { complementSuggestCount: parsed.value },
  });
  return NextResponse.json({ success: true, count: parsed.value });
}

export const GET = withStorefrontRevalidate(GETHandler);
export const PUT = withStorefrontRevalidate(PUTHandler);

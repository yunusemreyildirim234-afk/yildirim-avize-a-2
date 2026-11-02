import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { COMPANY_TAG } from "@/lib/company";

const TEXT_FIELDS = ["companyTitle", "taxOffice", "taxNumber", "mersisNo", "kepAddress", "headquartersAddress"] as const;

// Kurumsal & yasal bilgiler (yalnızca yönetici — proxy.ts /api/admin altını korur)
export async function PUT(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  const data: Record<string, string | null> = {};
  for (const key of TEXT_FIELDS) {
    const v = typeof body[key] === "string" ? body[key].trim().slice(0, 300) : "";
    if (!v) return NextResponse.json({ error: "Tüm kurumsal alanlar zorunludur." }, { status: 400 });
    data[key] = v;
  }

  const url = typeof body.etbisUrl === "string" ? body.etbisUrl.trim() : "";
  if (url && !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "ETBİS bağlantısı http(s):// ile başlamalıdır." }, { status: 400 });
  }
  data.etbisUrl = url || null;

  await prisma.siteConfig.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  revalidateTag(COMPANY_TAG, "max");
  revalidatePath("/", "layout");
  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { serverError } from "@/lib/api-error";
import { CUSTOMER_SEARCH_LIMIT, customerSearchWhere, normalizeCustomerQuery } from "@/lib/admin-customer-search";

// Kupon formundaki müşteri önerisi: tüm üyeleri sayfaya gömmek yerine yazdıkça arar (ad + e-posta; misafir hesaplar hariç).
export async function GET(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-customer-search", 120, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const q = normalizeCustomerQuery(new URL(req.url).searchParams.get("q"));
  if (!q) return NextResponse.json({ error: "En az 2 karakter girin.", customers: [] }, { status: 400 });
  try {
    const customers = await prisma.user.findMany({
      where: customerSearchWhere(q),
      select: { name: true, email: true },
      orderBy: { email: "asc" },
      take: CUSTOMER_SEARCH_LIMIT,
    });
    return NextResponse.json({ customers });
  } catch (error) {
    return serverError("admin/customers", error);
  }
}

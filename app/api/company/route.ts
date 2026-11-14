import { NextResponse } from "next/server";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { getCompanyInfo, toPublicCompany } from "@/lib/company";

// Sepetteki ön bilgilendirme formunda SATICI bölümünü doldurmak için kamuya açık kurumsal bilgiler (footer'daki verilerle aynı)
export async function GET(req: Request) {
  const rl = rateLimit(req, "company-get", 60, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  return NextResponse.json(toPublicCompany(await getCompanyInfo()));
}

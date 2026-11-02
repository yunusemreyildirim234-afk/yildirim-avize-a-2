import { NextResponse } from "next/server";
import { getCompanyInfo, toPublicCompany } from "@/lib/company";

// Sepetteki ön bilgilendirme formunda SATICI bölümünü doldurmak için kamuya açık kurumsal bilgiler (footer'daki verilerle aynı)
export async function GET() {
  return NextResponse.json(toPublicCompany(await getCompanyInfo()));
}

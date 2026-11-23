import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { serverError } from "@/lib/api-error";
import { listAllCoupons, toCouponRow } from "@/lib/admin-coupon-list";

// "Tümünü göster": sayfa yalnız aktif + son 100 kuponu getirir; tamamı burada, düğmeye basılınca okunur.
export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    return NextResponse.json({ coupons: (await listAllCoupons(prisma)).map(toCouponRow) });
  } catch (error) {
    return serverError("admin/coupons/liste", error);
  }
}

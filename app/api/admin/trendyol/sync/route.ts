import { NextResponse } from "next/server";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { serverError } from "@/lib/api-error";
import { adminGuard } from "@/lib/admin-guard";
import { syncTrendyolProducts } from "@/lib/trendyol";

export const maxDuration = 300;

async function POSTHandler() {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    return NextResponse.json({ success: true, result: await syncTrendyolProducts() });
  } catch (error) {
    return serverError("admin/trendyol/sync", error, "Trendyol senkronizasyonu başarısız oldu. Lütfen tekrar deneyin.", 502);
  }
}

export const POST = withStorefrontRevalidate(POSTHandler);

import { NextResponse } from "next/server";
import { syncTrendyolProducts } from "@/lib/trendyol";

export const maxDuration = 300;

export async function POST() {
  try {
    return NextResponse.json({ success: true, result: await syncTrendyolProducts() });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}

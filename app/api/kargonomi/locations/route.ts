import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import { listCities, listStates } from "@/lib/kargonomi";
import { rateLimit, tooMany } from "@/lib/rate-limit";

export async function GET(req: Request) {
  // Kargonomi'ye giden herkese açık uç: IP başına dakikada 60 istek
  const rl = rateLimit(req, "locations", 60, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const stateId = Number(new URL(req.url).searchParams.get("stateId"));

  try {
    if (stateId) {
      const cities: { id: number; name: string }[] = await listCities(stateId);
      return NextResponse.json({ cities: cities.map(({ id, name }) => ({ id, name })) });
    }
    const states: { id: number; name: string }[] = await listStates();
    return NextResponse.json({ states: states.map(({ id, name }) => ({ id, name })) });
  } catch (error) {
    return serverError("kargonomi/locations", error, "Konum listesi şu an alınamadı. Lütfen tekrar deneyin.", 502);
  }
}

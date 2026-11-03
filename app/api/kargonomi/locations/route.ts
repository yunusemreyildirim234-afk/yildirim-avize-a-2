import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import { listCities, listStates } from "@/lib/kargonomi";

export async function GET(req: Request) {
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

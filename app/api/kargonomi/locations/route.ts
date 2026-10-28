import { NextResponse } from "next/server";
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
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}

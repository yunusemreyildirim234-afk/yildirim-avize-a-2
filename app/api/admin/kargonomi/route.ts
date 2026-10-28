import { NextResponse } from "next/server";
import { countShipments, listWarehouses } from "@/lib/kargonomi";

// Kargonomi API bağlantı kontrolü ve özet bilgiler
export async function GET() {
  try {
    const [warehouses, shipmentCount] = await Promise.all([listWarehouses(), countShipments()]);
    const list: { name: string; city: string }[] = warehouses?.data ?? [];
    return NextResponse.json({
      connected: true,
      shipmentCount,
      warehouse: list[0] ? `${list[0].name} (${list[0].city})` : null,
    });
  } catch (error) {
    return NextResponse.json({ connected: false, error: (error as Error).message }, { status: 200 });
  }
}

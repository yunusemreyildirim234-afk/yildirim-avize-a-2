import { NextResponse } from "next/server";
import { confirmBankPayment } from "@/lib/orders";

// Yönetici havale ödemesini onaylar (proxy yalnızca yöneticiye açar)
export async function POST(req: Request) {
  const { orderId } = await req.json().catch(() => ({}));
  if (typeof orderId !== "string") return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
  const ok = await confirmBankPayment(orderId);
  if (!ok) return NextResponse.json({ error: "Sipariş onay bekleyen havale durumunda değil." }, { status: 409 });
  return NextResponse.json({ success: true });
}

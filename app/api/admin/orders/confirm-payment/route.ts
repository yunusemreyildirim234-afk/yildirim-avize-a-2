import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { confirmBankPayment } from "@/lib/orders";

// Yönetici havale ödemesini onaylar (proxy yalnızca yöneticiye açar)
// Havale siparişinin stoğu sipariş anında ayrılmıştır: onay vitrini değiştirmez. Eski (rezervesiz) kayıtta stok burada düşerse deductOrderStock vitrini kendisi yeniler.
async function POSTHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { orderId } = await req.json().catch(() => ({}));
  if (typeof orderId !== "string") return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
  const ok = await confirmBankPayment(orderId);
  if (!ok) return NextResponse.json({ error: "Sipariş onay bekleyen havale durumunda değil." }, { status: 409 });
  return NextResponse.json({ success: true });
}

export const POST = POSTHandler;

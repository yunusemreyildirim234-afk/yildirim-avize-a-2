import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { confirmBankPayment } from "@/lib/orders";
import { withStorefrontRevalidate } from "@/lib/revalidate";

// Yönetici havale ödemesini onaylar (proxy yalnızca yöneticiye açar)
// Onayla stok düşer (çok satanlar/stok görünümü) → başarılı yanıtta vitrin yenilenir
async function POSTHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { orderId } = await req.json().catch(() => ({}));
  if (typeof orderId !== "string") return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
  const ok = await confirmBankPayment(orderId);
  if (!ok) return NextResponse.json({ error: "Sipariş onay bekleyen havale durumunda değil." }, { status: 409 });
  return NextResponse.json({ success: true });
}

export const POST = withStorefrontRevalidate(POSTHandler);

import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";

// Seçili siparişleri (ve bağlı kalem, fatura, dekont kayıtlarını) kalıcı siler. Stok ve kupon sayaçları geri yüklenmez.
export async function DELETE(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? [...new Set<string>(body.ids.filter((i: unknown): i is string => typeof i === "string"))].slice(0, 500) : [];
  if (ids.length === 0) return NextResponse.json({ error: "Sipariş seçilmedi." }, { status: 400 });

  // Bağımlı kayıtlar önce silinir (foreign key sırası)
  const [, , , orders] = await prisma.$transaction([
    prisma.receiptFile.deleteMany({ where: { orderId: { in: ids } } }),
    prisma.orderInvoice.deleteMany({ where: { orderId: { in: ids } } }),
    prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } }),
    prisma.order.deleteMany({ where: { id: { in: ids } } }),
  ]);
  return NextResponse.json({ success: true, deleted: orders.count });
}

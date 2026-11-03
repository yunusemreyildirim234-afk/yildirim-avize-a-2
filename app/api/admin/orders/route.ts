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

  // OrderInvoice tablosu veritabanında yoksa (P2021) başarısız SQL ifadesi tüm işlemi bozar; bu yüzden varlığı önce denetlenir
  const invoiceTable = await prisma
    .$queryRaw<{ ok: boolean }[]>`SELECT to_regclass('public."OrderInvoice"') IS NOT NULL AS ok`
    .then((r) => r[0]?.ok ?? true)
    .catch(() => true);

  // Bağımlı kayıtlar önce silinir (foreign key sırası); hepsi tek işlemde
  const results = await prisma.$transaction([
    prisma.receiptFile.deleteMany({ where: { orderId: { in: ids } } }),
    ...(invoiceTable ? [prisma.orderInvoice.deleteMany({ where: { orderId: { in: ids } } })] : []),
    prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } }),
    prisma.order.deleteMany({ where: { id: { in: ids } } }),
  ]);
  const orders = results[results.length - 1];
  return NextResponse.json({ success: true, deleted: orders.count });
}

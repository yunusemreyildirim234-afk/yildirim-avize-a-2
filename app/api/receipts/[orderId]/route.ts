import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { ADMIN_COOKIE, verifySession } from "@/lib/session";

// Dekont yalnızca yöneticiye veya siparişin sahibine açıktır
export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const isAdmin = Boolean(await verifySession((await cookies()).get(ADMIN_COOKIE)?.value));
  if (!isAdmin) {
    const uid = await getSessionUserId();
    const owner = uid ? await prisma.order.findFirst({ where: { id: orderId, userId: uid }, select: { id: true } }) : null;
    if (!owner) return new Response("Yetkisiz", { status: 403 });
  }
  const file = await prisma.receiptFile.findUnique({ where: { orderId } });
  if (!file) return new Response("Bulunamadı", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "Content-Type": file.mime, "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

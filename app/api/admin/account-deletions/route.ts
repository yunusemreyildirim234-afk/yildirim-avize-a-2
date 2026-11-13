import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { serverError } from "@/lib/api-error";
import { approveDeletionRequest, isDeletedEmail, isOpenOrder, rejectDeletionRequest } from "@/lib/account-deletion";
import { deletionDbFor } from "@/lib/account-deletion-db";
import { cleanGuestEmail } from "@/lib/guest-email";
import { sendAccountDeletedEmail } from "@/lib/email";
import { notifyCustomer } from "@/lib/notifications";

// Hesap silme talepleri (yalnızca yönetici). Bekleyenler önce, sonra en yeniler.
export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const rows = await prisma.accountDeletionRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { id: true, name: true, email: true, createdAt: true, lastLoginAt: true } } },
    });
    const pendingUserIds = rows.filter((r) => r.status === "PENDING").map((r) => r.userId);
    const orders = pendingUserIds.length
      ? await prisma.order.findMany({ where: { userId: { in: pendingUserIds } }, select: { userId: true, status: true, cancelReturnStatus: true } })
      : [];
    const items = rows.map((r) => {
      const mine = orders.filter((o) => o.userId === r.userId);
      return {
        id: r.id,
        status: r.status,
        adminNote: r.adminNote,
        createdAt: r.createdAt.toISOString(),
        processedAt: r.processedAt?.toISOString() ?? null,
        name: r.user.name,
        email: isDeletedEmail(r.user.email) ? null : cleanGuestEmail(r.user.email),
        registeredAt: r.user.createdAt.toISOString(),
        lastLoginAt: r.user.lastLoginAt?.toISOString() ?? null,
        orderCount: r.status === "PENDING" ? mine.length : null,
        openOrderCount: r.status === "PENDING" ? mine.filter(isOpenOrder).length : null,
      };
    });
    items.sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING"));
    return NextResponse.json({ requests: items });
  } catch (error) {
    return serverError("admin/hesap-silme/liste", error);
  }
}

// Onay (kişisel verileri siler, hesabı anonimleştirir) veya ret
export async function PATCH(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const action = body?.action;
  const note = typeof body?.adminNote === "string" && body.adminNote.trim() ? body.adminNote.trim().slice(0, 500) : null;
  if (!id || (action !== "approve" && action !== "reject")) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  try {
    if (action === "reject") {
      const result = await prisma.$transaction((tx) => rejectDeletionRequest(deletionDbFor(tx), id, note));
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      await notifyCustomer(
        { userId: result.userId },
        { title: "Hesap silme talebiniz", message: note ? `Talebiniz karşılanamadı: ${note}` : "Hesap silme talebiniz şu an karşılanamadı. Ayrıntı için bizimle iletişime geçebilirsiniz.", type: "SYSTEM", link: "/giris" }
      );
      return NextResponse.json({ success: true });
    }

    const result = await prisma.$transaction((tx) => approveDeletionRequest(deletionDbFor(tx), id, note), { timeout: 20_000, maxWait: 10_000 });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    // Silme bildirimi işlem tamamlandıktan sonra, anonimleştirmeden önce okunan gerçek adrese; hata silmeyi geri almaz
    await sendAccountDeletedEmail({ to: result.email, name: result.name }).catch((err) => console.error("[hesap-silme] bildirim e-postası gönderilemedi:", (err as Error)?.message));
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("admin/hesap-silme/islem", error);
  }
}

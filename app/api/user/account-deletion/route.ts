import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";
import { cancelDeletionRequest, createDeletionRequest } from "@/lib/account-deletion";
import { deletionDbFor } from "@/lib/account-deletion-db";
import { sendAccountDeletionRequestedEmail } from "@/lib/email";
import { notifyAdmins } from "@/lib/notifications";

const NEED_LOGIN = () => NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });

// Giriş yapmış müşterinin hesap silme talebi: son talebin durumu (silme yönetici onayıyla yapılır).
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ request: null });
  try {
    const r = await prisma.accountDeletionRequest.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { status: true, createdAt: true, adminNote: true } });
    return NextResponse.json({ request: r ? { status: r.status, createdAt: r.createdAt.toISOString(), adminNote: r.status === "REJECTED" ? r.adminNote : null } : null });
  } catch (error) {
    return serverError("hesap-silme/durum", error);
  }
}

export async function POST(req: Request) {
  const rl = rateLimit(req, "account-deletion", 5, 60 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const userId = await getSessionUserId();
  if (!userId) return NEED_LOGIN();
  try {
    const result = await prisma.$transaction((tx) => createDeletionRequest(deletionDbFor(tx), userId));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    if (result.created) {
      // Bildirimler en iyi çabadır: talep zaten kaydedildi
      await Promise.allSettled([
        sendAccountDeletionRequestedEmail({ to: result.email, name: result.name }),
        notifyAdmins({ title: "Hesap silme talebi", message: "Bir müşteri hesabının silinmesini talep etti.", type: "SYSTEM", link: "/admin#hesap-silme" }),
      ]);
    }
    return NextResponse.json({ success: true, created: result.created }, { status: result.created ? 201 : 200 });
  } catch (error) {
    return serverError("hesap-silme/talep", error);
  }
}

// Talepten vazgeçme
export async function DELETE(req: Request) {
  const rl = rateLimit(req, "account-deletion", 5, 60 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const userId = await getSessionUserId();
  if (!userId) return NEED_LOGIN();
  try {
    const result = await prisma.$transaction((tx) => cancelDeletionRequest(deletionDbFor(tx), userId));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("hesap-silme/iptal", error);
  }
}

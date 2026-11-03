import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { cleanDisplayName } from "@/lib/validation";

// Yönetici, üyenin yalnızca görünen adını düzenler (e-posta, şifre, rol değişmez).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-user-name", 30, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const checked = cleanDisplayName(body.name);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, password: true } });
  if (!user || user.password === "guest_checkout") return NextResponse.json({ error: "Üye bulunamadı." }, { status: 404 });

  await prisma.user.update({ where: { id }, data: { name: checked.name } });
  return NextResponse.json({ success: true, oldName: user.name, name: checked.name });
}

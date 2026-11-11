import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { badRequest, serverError } from "@/lib/api-error";
import { cleanAddressInput } from "@/lib/address-book";
import { deleteAddress, updateAddress } from "@/lib/address-store";
import { addressDbFor, toPublicAddress } from "@/lib/address-db";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
type Ctx = { params: Promise<{ id: string }> };

// Sahiplik denetimi AddressDb.find(id, userId) içindedir: başkasının adresi 404 döner (varlığı sızdırılmaz).
export async function PATCH(req: Request, ctx: Ctx) {
  const rl = rateLimit(req, "address-write", 30, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Adres bulunamadı." }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest();
  const checked = cleanAddressInput(body);
  if (!checked.ok) return NextResponse.json({ error: checked.error, field: checked.field }, { status: 400 });

  try {
    const result = await prisma.$transaction((tx) => updateAddress(addressDbFor(tx), userId, id, checked.data));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, address: toPublicAddress(result.row) });
  } catch (error) {
    return serverError("adresler/guncelle", error);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const rl = rateLimit(req, "address-write", 30, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Adres bulunamadı." }, { status: 404 });

  try {
    const result = await prisma.$transaction((tx) => deleteAddress(addressDbFor(tx), userId, id));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("adresler/sil", error);
  }
}

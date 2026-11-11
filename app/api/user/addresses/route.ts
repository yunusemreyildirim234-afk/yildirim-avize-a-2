import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { badRequest, serverError } from "@/lib/api-error";
import { cleanAddressInput, sortAddresses } from "@/lib/address-book";
import { createAddress } from "@/lib/address-store";
import { addressDbFor, toPublicAddress } from "@/lib/address-db";

// Giriş yapmış müşterinin kayıtlı teslimat adresleri (adres defteri). Yalnızca kendi adreslerini görür ve değiştirir.
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  try {
    const rows = await prisma.address.findMany({ where: { userId } });
    return NextResponse.json({ addresses: sortAddresses(rows).map(toPublicAddress) });
  } catch (error) {
    return serverError("adresler/liste", error);
  }
}

export async function POST(req: Request) {
  const rl = rateLimit(req, "address-write", 30, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest();
  const checked = cleanAddressInput(body);
  if (!checked.ok) return NextResponse.json({ error: checked.error, field: checked.field }, { status: 400 });

  try {
    const result = await prisma.$transaction((tx) => createAddress(addressDbFor(tx), userId, checked.data));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, address: toPublicAddress(result.row) }, { status: 201 });
  } catch (error) {
    return serverError("adresler/ekle", error);
  }
}

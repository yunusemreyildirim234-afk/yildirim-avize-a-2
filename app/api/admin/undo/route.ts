import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { restoreSnapshot, type UndoSnapshot } from "@/lib/admin-undo";

// Son ürün işlemini önceki durumuna döndürür
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  if (!body.snapshot || typeof body.snapshot !== "object") return NextResponse.json({ error: "Geri alınacak kayıt yok." }, { status: 400 });
  try {
    const restored = await restoreSnapshot(body.snapshot as UndoSnapshot);
    return NextResponse.json({ success: true, restored });
  } catch (e) {
    return NextResponse.json({ error: `Geri alınamadı: ${(e as Error).message}` }, { status: 500 });
  }
}

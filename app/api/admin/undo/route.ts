import { NextResponse } from "next/server";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { adminGuard } from "@/lib/admin-guard";
import { UndoError, restoreFromToken } from "@/lib/admin-undo";

// Son ürün işlemini geri alır. Gövde: { snapshot: <sunucunun imzaladığı belirteç>, force?: boolean }
async function POSTHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    const restored = await restoreFromToken(body.snapshot, body.force === true);
    return NextResponse.json({ success: true, restored });
  } catch (e) {
    if (e instanceof UndoError) return NextResponse.json({ error: e.message, conflict: e.conflict }, { status: e.status });
    console.error("[undo] beklenmeyen hata:", (e as Error).message);
    return NextResponse.json({ error: "Geri alınamadı. Lütfen sayfayı yenileyip kontrol edin." }, { status: 500 });
  }
}

export const POST = withStorefrontRevalidate(POSTHandler);

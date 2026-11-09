import { NextResponse } from "next/server";

// KAPATILDI: doğrulamasız olduğu için başkası adına onay yazılabiliyordu. Onay artık /api/order içinde siparişin e-postasıyla kaydedilir.
// Eski önbellekli istemciler hata görmesin diye her zaman başarılı ama kayıtsız döner.
export async function POST() {
  return NextResponse.json({ success: true, recorded: false });
}

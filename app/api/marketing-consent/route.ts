import { NextResponse } from "next/server";
import { rateLimit, requestIp, tooMany } from "@/lib/rate-limit";
import { EMAIL_RE } from "@/lib/validation";
import { recordConsent } from "@/lib/marketing";

// Sepet formundaki isteğe bağlı "kampanya e-postası" onayını kaydeder. Sipariş akışından bağımsızdır:
// veritabanı hatasında bile 500 üretmez (kayıt yapılamadıysa recorded: false döner).
export async function POST(req: Request) {
  const rl = rateLimit(req, "marketing-consent", 10, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta adresi giriniz." }, { status: 400 });

  // Yalnızca açık onay (true) kaydedilir; onay yoksa hiçbir şey yapılmaz
  if (body.consent !== true) return NextResponse.json({ success: true, recorded: false });

  const recorded = await recordConsent({
    email,
    ip: requestIp(req),
    userAgent: req.headers.get("user-agent"),
    source: "sepet",
  });
  return NextResponse.json({ success: true, recorded });
}

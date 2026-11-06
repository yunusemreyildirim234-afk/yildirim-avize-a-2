import { NextResponse } from "next/server";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { unsubscribe, verifyUnsubscribeToken } from "@/lib/marketing";

// GET yan etkisizdir (e-posta tarayıcıları bağlantıyı önceden açar): onay sayfasına yönlendirir.
export function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  return NextResponse.redirect(new URL(`/abonelik-iptal?t=${encodeURIComponent(t.slice(0, 600))}`, req.url), 303);
}

// POST: (a) e-posta istemcisinin tek tıkla çıkışı (RFC 8058, gövde "List-Unsubscribe=One-Click") → 200; (b) onay sayfasındaki form → sayfaya geri yönlendirir.
export async function POST(req: Request) {
  const rl = rateLimit(req, "unsubscribe", 20, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const form = await req.formData().catch(() => null);
  const oneClick = form?.get("List-Unsubscribe") === "One-Click";
  const email = verifyUnsubscribeToken(t);
  const ok = email ? await unsubscribe(email) : false;
  if (oneClick) return NextResponse.json({ success: ok }, { status: email ? (ok ? 200 : 503) : 400 });
  const state = !email ? "invalid" : ok ? "ok" : "error";
  return NextResponse.redirect(new URL(`/abonelik-iptal?t=${encodeURIComponent(t.slice(0, 600))}&s=${state}`, req.url), 303);
}

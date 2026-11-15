import { NextResponse } from "next/server";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { parseCartProductIds } from "@/lib/complements";
import { loadSuggestions } from "@/lib/complement-suggestions";

// SALT OKUNUR: sepetteki ürünlerin "bununla birlikte alın" önerileri. Sepetteki ürünler gizlenir ve sayıya girmez; kart sayısı ayardan.
// Yazma, oturum, e-posta yok; aynı ürün kümesi aynı adres olduğundan CDN/tarayıcı önbelleği tek kayıt tutar (Neon dostu).
export async function GET(req: Request) {
  const rl = rateLimit(req, "cart-complements", 60, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const ids = parseCartProductIds(new URL(req.url).searchParams.get("ids"));
  if (!ids) return NextResponse.json({ error: "Geçersiz ürün listesi." }, { status: 400 });
  const { suggestions } = await loadSuggestions(ids, new Set(ids));
  return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}

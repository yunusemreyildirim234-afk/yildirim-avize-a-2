"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { isShortOrderCode, pickVerifiedOrder } from "@/lib/order-lookup";

/**
 * Takip formu (POST): 8 haneli sipariş kodu + e-posta eşleşirse siparişin takip sayfasına gider.
 * E-posta adrese YAZILMAZ. Başarısız ve sınırlanan denemeler aynı genel iletiyle döner (sipariş var/yok sızdırılmaz).
 * Kısa kod yoksa ya da e-posta boşsa mevcut davranış sürer: ?code= ile tam kimlik / takip kodu / barkod sorgusu.
 */
export async function trackOrder(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().slice(0, 100);
  const email = String(formData.get("email") ?? "").trim().slice(0, 254);
  if (!code) redirect("/kargo-takip");
  if (!isShortOrderCode(code) || !email) redirect(`/kargo-takip?code=${encodeURIComponent(code)}`);

  const rl = rateLimit(new Request("http://localhost/kargo-takip", { headers: await headers() }), "kargo-takip-kisa-kod", 8, 10 * 60_000);
  if (rl.limited) redirect(`/kargo-takip?code=${encodeURIComponent(code)}&dogrulama=sinir`);

  const rows = await prisma.order.findMany({
    where: { id: { startsWith: code.toLowerCase() } },
    select: { id: true, user: { select: { email: true } } },
    take: 5,
  });
  const hit = pickVerifiedOrder(rows.map((r) => ({ id: r.id, email: r.user.email })), email);
  if (!hit) redirect(`/kargo-takip?code=${encodeURIComponent(code)}&dogrulama=hata`);
  redirect(`/kargo-takip?code=${encodeURIComponent(hit.id)}`);
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { rateLimit } from "@/lib/rate-limit";
import { verifyUnsubscribeToken } from "@/lib/marketing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "E-posta Bildirimleri",
  robots: { index: false, follow: false },
};

type View = "confirm" | "ok" | "invalid" | "error" | "limited";

// Sayfa AÇILIŞI yan etkisizdir (e-posta güvenlik tarayıcıları bağlantıyı açar): çıkış yalnızca onay düğmesiyle (POST /api/unsubscribe) olur.
async function view(token: string | undefined, state: string | undefined): Promise<View> {
  const h = await headers();
  const rl = rateLimit(new Request("http://localhost/abonelik-iptal", { headers: h }), "unsubscribe-page", 60, 10 * 60_000);
  if (rl.limited) return "limited";
  if (!verifyUnsubscribeToken(token)) return "invalid"; // genel mesaj: kullanıcının varlığı sızdırılmaz
  if (state === "ok") return "ok";
  if (state === "error") return "error";
  return "confirm";
}

const MESSAGES: Record<Exclude<View, "confirm">, { title: string; text: string }> = {
  ok: { title: "Onayınız geri alındı", text: "Artık fiyat düşüşü ve kampanya e-postası göndermeyeceğiz. Sipariş ve kargo bilgilendirmeleri etkilenmez." },
  invalid: { title: "Bağlantı geçerli değil", text: "Bu bağlantı geçersiz veya hatalı görünüyor. E-postanızdaki bağlantıyı eksiksiz kopyaladığınızdan emin olun ya da bizimle iletişime geçin." },
  error: { title: "İşlem tamamlanamadı", text: "Talebiniz şu anda işlenemedi. Lütfen birkaç dakika sonra tekrar deneyin veya bizimle iletişime geçin." },
  limited: { title: "Çok fazla deneme", text: "Kısa sürede çok fazla istek alındı. Lütfen birkaç dakika sonra tekrar deneyin." },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string; s?: string }> }) {
  const { t, s } = await searchParams;
  const v = await view(t, s);
  return (
    <main className="min-h-screen bg-neutral-50 py-16 px-4">
      <div className="max-w-md mx-auto bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm text-center space-y-3">
        {v === "confirm" ? (
          <>
            <h1 className="text-xl font-serif font-bold text-neutral-900">E-posta bildirimlerinden çıkmak istiyor musunuz?</h1>
            <p className="text-sm text-neutral-600 leading-relaxed">Onaylarsanız fiyat düşüşü ve kampanya e-postaları göndermeyeceğiz. Sipariş ve kargo bilgilendirmeleri etkilenmez.</p>
            <form method="POST" action={`/api/unsubscribe?t=${encodeURIComponent((t ?? "").slice(0, 600))}`}>
              <button type="submit" className="mt-2 bg-neutral-900 hover:bg-amber-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600">
                Evet, bildirimleri kapat
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 role={v === "ok" ? "status" : "alert"} className="text-xl font-serif font-bold text-neutral-900">
              {MESSAGES[v].title}
            </h1>
            <p className="text-sm text-neutral-600 leading-relaxed">{MESSAGES[v].text}</p>
          </>
        )}
        <Link href="/" className="inline-block text-xs font-semibold text-amber-800 underline underline-offset-2 pt-2">
          Ana sayfaya dön
        </Link>
      </div>
    </main>
  );
}

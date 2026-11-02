import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { rateLimit } from "@/lib/rate-limit";
import { unsubscribe, verifyUnsubscribeToken } from "@/lib/marketing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Kampanya E-postası Aboneliği",
  robots: { index: false, follow: false },
};

type Result = "ok" | "invalid" | "error" | "limited";

async function handle(token: string | undefined): Promise<Result> {
  // Sayfa bir Request nesnesi almadığı için IP bazlı sınırlama istek başlıklarından kurulur
  const h = await headers();
  const rl = rateLimit(new Request("http://localhost/abonelik-iptal", { headers: h }), "unsubscribe", 20, 10 * 60_000);
  if (rl.limited) return "limited";
  const email = verifyUnsubscribeToken(token);
  if (!email) return "invalid";
  return (await unsubscribe(email)) ? "ok" : "error";
}

const MESSAGES: Record<Result, { title: string; text: string }> = {
  ok: { title: "Abonelikten çıkarıldınız", text: "Kampanya e-postası listemizden başarıyla çıkarıldınız. Bundan sonra size kampanya içerikli e-posta göndermeyeceğiz. Sipariş ve kargo bilgilendirmeleri etkilenmez." },
  invalid: { title: "Bağlantı geçerli değil", text: "Bu bağlantı geçersiz veya hatalı görünüyor. E-postanızdaki bağlantıyı eksiksiz kopyaladığınızdan emin olun ya da bizimle iletişime geçin." },
  error: { title: "İşlem tamamlanamadı", text: "Talebiniz şu anda işlenemedi. Lütfen birkaç dakika sonra bağlantıya yeniden tıklayın veya bizimle iletişime geçin." },
  limited: { title: "Çok fazla deneme", text: "Kısa sürede çok fazla istek alındı. Lütfen birkaç dakika sonra tekrar deneyin." },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const result = await handle((await searchParams).t);
  const m = MESSAGES[result];
  return (
    <main className="min-h-screen bg-neutral-50 py-16 px-4">
      <div className="max-w-md mx-auto bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm text-center space-y-3">
        <h1 role={result === "ok" ? "status" : "alert"} className="text-xl font-serif font-bold text-neutral-900">
          {m.title}
        </h1>
        <p className="text-sm text-neutral-600 leading-relaxed">{m.text}</p>
        <Link href="/" className="inline-block text-xs font-semibold text-amber-800 underline underline-offset-2 pt-2">
          Ana sayfaya dön
        </Link>
      </div>
    </main>
  );
}

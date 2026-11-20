"use client";

import Link from "next/link";

/** Beklenmeyen sayfa hatası: Türkçe, tekrar deneme ve ana sayfa bağlantısı (ayrıntı sunucu logunda kalır). */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-[70vh] bg-canvas flex items-center justify-center px-4 py-20">
      <div className="max-w-md text-center space-y-6">
        <span className="text-xs uppercase tracking-widest text-bronze-ink font-semibold">Bir sorun oluştu</span>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-ink">Sayfa şu an açılamadı</h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          Geçici bir hata oluştu. Lütfen tekrar deneyin; sorun sürerse WhatsApp hattımızdan bize ulaşabilirsiniz.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-ink hover:bg-bronze-ink text-canvas text-xs font-semibold px-6 py-3 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink"
          >
            Tekrar Dene
          </button>
          <Link
            href="/"
            className="bg-raised border border-line-strong hover:border-bronze-ink text-ink text-xs font-semibold px-6 py-3 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink"
          >
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    </main>
  );
}

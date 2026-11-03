"use client";

import Link from "next/link";

/** Beklenmeyen sayfa hatası: Türkçe, tekrar deneme ve ana sayfa bağlantısı (ayrıntı sunucu logunda kalır). */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-[70vh] bg-neutral-50 flex items-center justify-center px-4 py-20">
      <div className="max-w-md text-center space-y-6">
        <span className="text-xs uppercase tracking-widest text-amber-700 font-semibold">Bir sorun oluştu</span>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-neutral-900">Sayfa şu an açılamadı</h1>
        <p className="text-sm text-neutral-600 leading-relaxed">
          Geçici bir hata oluştu. Lütfen tekrar deneyin; sorun sürerse WhatsApp hattımızdan bize ulaşabilirsiniz.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-neutral-900 hover:bg-amber-600 text-white text-xs font-semibold px-6 py-3 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          >
            Tekrar Dene
          </button>
          <Link
            href="/"
            className="bg-white border border-neutral-300 hover:border-amber-500 text-neutral-800 text-xs font-semibold px-6 py-3 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          >
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sayfa Bulunamadı",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="min-h-[70vh] bg-neutral-50 flex items-center justify-center px-4 py-20">
      <div className="max-w-md text-center space-y-6">
        <span className="text-xs uppercase tracking-widest text-amber-600 font-semibold">Hata 404</span>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-neutral-900">Bu Işık Söndü</h1>
        <p className="text-sm text-neutral-600 leading-relaxed">
          Aradığınız sayfa taşınmış ya da kaldırılmış olabilir. Koleksiyonlarımıza göz atabilir veya ana sayfaya
          dönebilirsiniz.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/kategori/${c.slug}`}
              className="text-xs font-medium bg-white border border-neutral-300 text-neutral-700 px-4 py-2 rounded-xl hover:border-amber-500 hover:text-amber-700 transition-colors"
            >
              {c.title}
            </Link>
          ))}
        </div>
        <Link
          href="/"
          className="inline-block bg-neutral-900 hover:bg-amber-600 text-white text-xs font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Ana Sayfaya Dön →
        </Link>
      </div>
    </main>
  );
}

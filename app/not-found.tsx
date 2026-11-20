import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@/lib/site";
import { getExtraCategoryLinks, getFixedCategoryOverrides } from "@/lib/category-list";
import SearchBar from "@/components/SearchBar";
import ThemeSync from "@/components/ThemeSync";

export const metadata: Metadata = {
  title: "Sayfa Bulunamadı",
  robots: { index: false },
  alternates: { canonical: null }, // 404 sayfasının kanonik adresi yok (kökteki "/" miras alınmasın)
};

export default async function NotFound() {
  // Altbilgi/menüyle aynı liste: sabit kategoriler (gizlenenler hariç) + yönetim panelinden eklenenler
  const [overrides, extraCategories] = await Promise.all([getFixedCategoryOverrides(), getExtraCategoryLinks()]);
  const chipClass = "text-xs font-medium bg-raised border border-line-strong text-ink-muted px-4 py-2 rounded-xl hover:border-bronze-ink hover:text-bronze-ink transition-colors";
  return (
    <main className="min-h-[70vh] bg-canvas flex items-center justify-center px-4 py-20">
      <ThemeSync />
      <div className="max-w-md text-center space-y-6">
        <span className="text-xs uppercase tracking-widest text-bronze-ink font-semibold">Hata 404</span>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-ink">Bu Işık Söndü</h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          Aradığınız sayfa taşınmış ya da kaldırılmış olabilir. Koleksiyonlarımıza göz atabilir veya ana sayfaya
          dönebilirsiniz.
        </p>
        <div className="text-left">
          <SearchBar />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {CATEGORIES.filter((c) => !overrides[c.slug]?.hidden).map((c) => (
            <Link key={c.slug} href={`/kategori/${c.slug}`} className={chipClass}>
              {overrides[c.slug]?.title ?? c.title}
            </Link>
          ))}
          {extraCategories.map((c) => (
            <Link key={c.href} href={c.href} className={chipClass}>
              {c.label}
            </Link>
          ))}
        </div>
        <Link
          href="/"
          className="inline-block bg-ink hover:bg-bronze-ink text-canvas text-xs font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Ana Sayfaya Dön →
        </Link>
      </div>
    </main>
  );
}

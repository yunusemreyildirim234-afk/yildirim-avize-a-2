import Image from "next/image";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";

// Kurumsal amblem: /logo-hero-4.png (şeffaf arka planlı, orijinal renkler; CSS filtresi yok). Dekoratif: marka adı h1'de yazılıdır.
function LogoEmblem() {
  return (
    <Image src="/logo-hero-4.png" alt="" width={640} height={298} priority className="mx-auto h-auto w-44 sm:w-56" />
  );
}

export default function Hero({ categories = [] }: { categories?: { slug: string; title: string }[] }) {
  return (
    <section className="bg-white px-4 pt-6 pb-8 sm:pt-8 sm:pb-12">
      <div className="max-w-3xl mx-auto text-center">
        <LogoEmblem />
        <h1 className="mt-1 text-4xl sm:text-6xl font-serif font-black tracking-tight text-zinc-950">Yıldırım Avize</h1>
        <Image src="/logo-uc-gen.png" alt="" width={128} height={65} className="mx-auto mt-1 h-auto w-12 sm:w-14" />

        <div className="mt-5 sm:mt-6 max-w-2xl mx-auto">
          <SearchBar />
        </div>

        {categories.length > 0 && (
          <nav aria-label="Koleksiyon kategorileri" className="hidden md:block mt-3 max-w-3xl mx-auto">
            <ul className="flex w-fit max-w-full mx-auto gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categories.map((c) => (
                <li key={c.slug} className="shrink-0">
                  <Link
                    href={`/kategori/${c.slug}`}
                    className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 whitespace-nowrap hover:border-amber-600 hover:text-amber-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
                  >
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <p className="mt-5 text-lg sm:text-xl font-serif font-bold tracking-[0.15em] text-[#B5002A]">Avize &amp; Aydınlatma</p>
        <p className="mt-2 text-xs sm:text-sm text-zinc-500">Beyoğlu Şişhane&apos;den Türkiye&apos;ye kristal, modern ve klasik avizeler</p>
      </div>
    </section>
  );
}

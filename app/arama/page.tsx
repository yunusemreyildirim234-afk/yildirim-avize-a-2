import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductListing from "@/components/ProductListing";
import { getCategoryList } from "@/lib/category-list";
import { withVisibleProducts } from "@/lib/categories";
import { canonicalListing, pageHref, parseAdet, parsePage } from "@/lib/pagination";
import { MAX_SEARCH_RESULTS, clipQuery, searchWhere } from "@/lib/product-search";
import { getListing, type Listing } from "@/lib/listing";
import type { ProductWithVariations } from "@/lib/products";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const qOf = (raw: string | string[] | undefined) => clipQuery(Array.isArray(raw) ? raw[0] : raw).trim();

// Arama sonuçları dizine alınmaz, sitemap'te yoktur, canonical yazılmaz
export const metadata: Metadata = {
  title: "Arama Sonuçları",
  alternates: { canonical: null }, // layout varsayılanı "/" bu sayfada yazılmaz
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: Props) {
  const query = await searchParams;
  const q = qOf(query.q);
  const path = "/arama";

  let total = 0;
  let products: ProductWithVariations[] = [];
  let listing: Listing | null = null;
  let limited = false;
  let failed = false;

  if (q) {
    // Sayfa bir Request almadığı için IP bazlı sınır istek başlıklarından kurulur (kimliksiz ve indeksiz arama)
    const h = await headers();
    limited = rateLimit(new Request("http://localhost/arama", { headers: h }), "search-page", 60, 60_000).limited;
    if (!limited) {
      try {
        // Ortak liste katmanı: taban küme en çok MAX_SEARCH_RESULTS ürün; arama sorgusu için önbellek anahtarı üretilmez
        listing = await getListing({ where: searchWhere(q), cached: false, cap: MAX_SEARCH_RESULTS }, query);
        total = listing.total;
        const fix = canonicalListing(query, total);
        if (fix) redirect(pageHref(path, fix.page, { q, ...listing.params }, fix.adet));
        products = await listing.fetchPage(parsePage(query.sayfa), parseAdet(query.adet).size);
      } catch (e) {
        if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
        console.error("[arama]", (e as Error).message);
        failed = true;
      }
    }
  }

  const { adet, size } = parseAdet(query.adet);
  const page = parsePage(query.sayfa);
  const categories = products.length === 0 ? withVisibleProducts(await getCategoryList().catch(() => [])).slice(0, 8) : [];

  const emptyBlock = (
        <div className="bg-zinc-50 rounded-3xl border border-zinc-200 p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4">
          <h2 className="font-serif font-bold text-zinc-900 text-lg">
            {!q ? "Aramak için bir ifade yazın" : limited ? "Çok fazla arama yapıldı" : failed ? "Arama şu an yapılamadı" : "Aradığınız ürün bulunamadı"}
          </h2>
          <p className="text-sm text-zinc-600">
            {!q
              ? "Ürün adı, model kodu veya stok kodu ile arayabilirsiniz."
              : limited
                ? "Lütfen bir dakika sonra tekrar deneyin."
                : failed
                  ? "Lütfen biraz sonra tekrar deneyin."
                  : "Yazımı kontrol edin veya aşağıdaki kategorilere göz atın."}
          </p>
          <form action="/arama" role="search" className="flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              maxLength={80}
              aria-label="Ürün adı, model kodu veya stok kodu ile ara"
              placeholder="Ürün adı, model kodu..."
              className="flex-1 min-w-0 text-base sm:text-sm px-4 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"
            />
            <button type="submit" className="bg-zinc-900 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              Ara
            </button>
          </form>
          {categories.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-2 pt-2">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/kategori/${c.slug}`} className="inline-block text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-full">
                    {c.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/kategori/tum" className="inline-block text-xs font-semibold text-zinc-900 underline underline-offset-2 px-2 py-1.5">
                  Tüm ürünler →
                </Link>
              </li>
            </ul>
          )}
        </div>
  );

  return (
    <main className="min-h-screen bg-white pb-20">
      <section className="bg-zinc-50 border-b border-zinc-200 py-12 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-3">
          <Breadcrumbs className="text-zinc-500 mb-2 flex justify-center" items={[{ name: "Ana Sayfa", href: "/" }, { name: "Arama", href: "/arama" }]} />
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-zinc-900">Arama Sonuçları</h1>
          {q && (
            <p className="text-sm text-zinc-600 break-words">
              <span className="font-semibold text-zinc-900">&ldquo;{q}&rdquo;</span> için {total} sonuç
              {total >= MAX_SEARCH_RESULTS ? " (ilk " + MAX_SEARCH_RESULTS + " ürün gösterilir)" : ""}
            </p>
          )}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        {listing ? (
          <ProductListing path={path} fixed={{ q }} listing={listing} products={products} page={page} adet={adet} size={size} empty={emptyBlock} />
        ) : (
          emptyBlock
        )}
      </section>
    </main>
  );
}

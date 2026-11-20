import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductListing from "@/components/ProductListing";
import { getCategoryList, getCategorySettings } from "@/lib/category-list";
import { categoryDisplayTitle } from "@/lib/category-settings";
import { withVisibleProducts } from "@/lib/categories";
import { canonicalListing, pageHref, parseAdet, parsePage } from "@/lib/pagination";
import { MAX_SEARCH_RESULTS, clipQuery } from "@/lib/product-search";
import { getListing, searchCorrection, type Listing } from "@/lib/listing";
import type { ProductWithVariations } from "@/lib/products";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const qOf = (raw: string | string[] | undefined) => clipQuery(Array.isArray(raw) ? raw[0] : raw).trim();

// Arama sonuçları (düzeltilmiş sonuç sayfaları ve "tam=1" dahil) dizine alınmaz, sitemap'te yoktur, canonical yazılmaz; sekme başlığı kullanıcının yazdığı sorguyu içerir
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = qOf((await searchParams).q);
  return {
    title: q ? `"${q}" araması` : "Arama Sonuçları",
    alternates: { canonical: null }, // layout varsayılanı "/" bu sayfada yazılmaz
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const query = await searchParams;
  const q = qOf(query.q);
  const path = "/arama";

  let total = 0;
  let products: ProductWithVariations[] = [];
  let listing: Listing | null = null;
  let limited = false;
  let failed = false;
  let suggestion: string | null = null;
  /** Otomatik düzeltme uygulandıysa gösterilen (düzeltilmiş) sorgu; sonuçlar, sayfalama ve sayılar buna aittir, adres ve bağlantılar özgün q'yu taşır */
  let corrected: string | null = null;
  const exact = (Array.isArray(query.tam) ? query.tam[0] : query.tam) === "1"; // "Yine de ara": düzeltmesiz

  if (q) {
    // Sayfa bir Request almadığı için IP bazlı sınır istek başlıklarından kurulur (kimliksiz ve indeksiz arama)
    const h = await headers();
    limited = rateLimit(new Request("http://localhost/arama", { headers: h }), "search-page", 60, 60_000).limited;
    if (!limited) {
      try {
        // Ortak liste katmanı: önbellekli katalog normalize metinle bellekte süzülür; sorgu başına önbellek anahtarı üretilmez
        listing = await getListing({ search: q }, query);
        // Gerçek 0 sonuçta (filtreden kaynaklanmayan) düzeltme: güvenliyse sonuçlar doğrudan düzeltilmiş sorguyla, değilse yalnızca "Bunu mu demek istediniz".
        // Önbellekli katalogdan bellekte; veritabanına ek okuma yok.
        if (listing.total === 0 && !exact && Object.keys(listing.params).every((k) => k === "siralama")) {
          const fix = await searchCorrection(q).catch(() => null);
          if (fix?.auto) {
            listing = await getListing({ search: fix.text }, query);
            corrected = fix.text;
          } else if (fix) suggestion = fix.text;
        }
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
  const categorySettings = products.length === 0 ? await getCategorySettings() : {};
  // Sabit kategorilerin yönetimden verilen görünen adı (örn. "Sarkıt Modelleri") varsayılan addan önce gelir
  const categories = products.length === 0 ? withVisibleProducts(await getCategoryList().catch(() => [])).slice(0, 8).map((c) => (c.fixed ? { ...c, title: categoryDisplayTitle(categorySettings, c.key, c.title) } : c)) : [];

  const emptyBlock = (
        <div className="bg-surface rounded-3xl border border-line p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4">
          <h2 className="font-serif font-bold text-ink text-lg">
            {!q ? "Aramak için bir ifade yazın" : limited ? "Çok fazla arama yapıldı" : failed ? "Arama şu an yapılamadı" : "Aradığınız ürün bulunamadı"}
          </h2>
          <p className="text-sm text-ink-muted">
            {!q
              ? "Ürün adı, model kodu veya stok kodu ile arayabilirsiniz."
              : limited
                ? "Lütfen bir dakika sonra tekrar deneyin."
                : failed
                  ? "Lütfen biraz sonra tekrar deneyin."
                  : "Yazımı kontrol edin veya aşağıdaki kategorilere göz atın."}
          </p>
          {suggestion && (
            <p className="text-sm text-ink">
              Bunu mu demek istediniz:{" "}
              <Link href={`/arama?q=${encodeURIComponent(suggestion)}`} className="font-semibold text-bronze-ink underline underline-offset-2">
                {suggestion}
              </Link>
              ?
            </p>
          )}
          <form action="/arama" role="search" className="flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              maxLength={80}
              aria-label="Ürün adı, model kodu veya stok kodu ile ara"
              placeholder="Ürün adı, model kodu..."
              className="flex-1 min-w-0 text-base sm:text-sm px-4 py-2.5 rounded-xl border border-line-strong bg-raised text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-bronze-ink"
            />
            <button type="submit" className="bg-ink hover:bg-bronze-ink text-canvas text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              Ara
            </button>
          </form>
          {categories.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-2 pt-2">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/kategori/${c.slug}`} className="inline-block text-xs font-medium text-bronze-ink bg-surface hover:bg-line border border-line px-3 py-1.5 rounded-full">
                    {c.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/kategori/tum" className="inline-block text-xs font-semibold text-ink underline underline-offset-2 px-2 py-1.5">
                  Tüm ürünler →
                </Link>
              </li>
            </ul>
          )}
        </div>
  );

  return (
    <main className="min-h-screen bg-canvas pb-20">
      <section className="bg-surface border-b border-line py-8 sm:py-12 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-3">
          <Breadcrumbs className="text-ink-muted mb-2 flex justify-center" items={[{ name: "Ana Sayfa", href: "/" }, { name: "Arama", href: "/arama" }]} />
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-ink">Arama Sonuçları</h1>
          {q && (
            <p className="text-sm text-ink-muted break-words">
              <span className="font-semibold text-ink">&ldquo;{corrected ?? q}&rdquo;</span> için {total} sonuç
              {total >= MAX_SEARCH_RESULTS ? " (ilk " + MAX_SEARCH_RESULTS + " ürün gösterilir)" : ""}
            </p>
          )}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
        {corrected && (
          <p role="status" data-testid="arama-duzeltme" className="mb-6 text-sm text-ink-muted text-center break-words">
            &ldquo;{q}&rdquo; için sonuç bulunamadı. <strong className="text-ink">&ldquo;{corrected}&rdquo;</strong> sonuçları gösteriliyor.{" "}
            <Link href={`/arama?q=${encodeURIComponent(q)}&tam=1`} className="font-semibold text-bronze-ink underline underline-offset-2">
              Yine de &ldquo;{q}&rdquo; ara
            </Link>
          </p>
        )}
        {listing ? (
          <ProductListing path={path} fixed={{ q }} listing={listing} products={products} page={page} adet={adet} size={size} empty={emptyBlock} />
        ) : (
          emptyBlock
        )}
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard from "@/components/ProductCard";
import { prisma } from "@/lib/db";
import Pagination from "@/components/Pagination";
import { DISCOUNTED, FEATURED, countProductsCached, getBestSellers, getProductsCached } from "@/lib/products";
import PageSizeLinks from "@/components/PageSizeLinks";
import { canonicalListing, pageHref, parseAdet, parsePage, rangeOf, totalPages } from "@/lib/pagination";
import { CATEGORIES, COLLECTIONS } from "@/lib/site";
import { getCategoryConfig, getCategoryList } from "@/lib/category-list";
import { RESERVED_SLUGS, categoryKey, findDynamicCategory, visibleCategoryWhere } from "@/lib/categories";
import { categoryDisplayTitle, resolveRedirect } from "@/lib/category-settings";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// generateMetadata ve sayfa aynı istekte aynı çözümü paylaşır (tekrar sayım/groupBy sorgusu yok)
const resolve = cache(async (slug: string) => {
  const category = CATEGORIES.find((c) => c.slug === slug);
  if (category) {
    // Sabit kategori: ad/slug aynen; büyük/küçük harf ve boşluk varyantı yazımlar da (category IN) dahil. Liste alınamazsa eski tam eşleşme.
    const entry = await getCategoryList().then((l) => l.find((c) => c.fixed && c.slug === slug)).catch(() => undefined);
    // Görünen ad ayarı varsa yeni ad (sayfa başlığı, metadata, breadcrumb); yoksa mevcut başlık aynen. Gizli kategorinin adresi çalışmaya devam eder.
    const settings = await getCategoryConfig().then((c) => c.settings).catch(() => ({}));
    return { title: categoryDisplayTitle(settings, categoryKey(category.dbCategory), category.title), desc: category.desc, where: visibleCategoryWhere(entry?.spellings ?? [category.dbCategory]) };
  }
  if (slug === "tum") return { ...COLLECTIONS.tum, where: {} };
  if (slug === "one-cikanlar") {
    // Yönetici işaretlileri varsa yalnızca onlar; yoksa otomatik seçim
    const flagged = await prisma.product.count({ where: { active: true, isFeatured: true } });
    return { ...COLLECTIONS["one-cikanlar"], where: flagged > 0 ? { isFeatured: true } : FEATURED };
  }
  if (slug === "cok-satanlar") return { ...COLLECTIONS["cok-satanlar"], where: null };
  if (slug === "indirimli") return { ...COLLECTIONS.indirimli, where: DISCOUNTED };

  // Yönetim panelinden eklenen yeni koleksiyonlar: tek kaynak lib/category-list.ts (büyük/küçük harf birleştirilmiş; yazımlar IN ile aranır)
  const match = findDynamicCategory(await getCategoryList(), slug);
  if (match) {
    return { title: match.title, desc: `${match.title} koleksiyonundaki avize ve aydınlatma modelleri.`, where: visibleCategoryWhere(match.spellings) };
  }
  return null;
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const current = await resolve(slug);
  if (!current) return {};
  // Her sayfanın kendi kanonik adresi vardır (sayfa=1 parametresiz)
  const sp = await searchParams;
  const page = parsePage(sp.sayfa);
  const { adet } = parseAdet(sp.adet);
  const path = `/kategori/${slug}`;
  // Varsayılan olmayan sayfa boyutu: aynı içeriğin kopyası → noindex,follow ve varsayılan boyutlu birinci sayfaya canonical
  if (adet !== "24") {
    const base = pageHref(path, 1);
    return {
      title: current.title,
      description: current.desc,
      alternates: { canonical: base },
      robots: { index: false, follow: true },
      openGraph: { title: current.title, description: current.desc, url: base },
    };
  }
  const url = pageHref(path, page);
  return {
    title: page > 1 ? `${current.title} - Sayfa ${page}` : current.title,
    description: current.desc,
    alternates: { canonical: url },
    openGraph: { title: current.title, description: current.desc, url },
    // "next" burada yazılmaz (toplam sayı metadata'da okunmuyor); sayfadaki Sonraki bağlantısı rel="next" taşır
    ...(page > 1 ? { pagination: { previous: pageHref(path, page - 1) } } : {}),
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const current = await resolve(slug);
  if (!current) {
    // Yeniden adlandırılmış kategorinin eski adresi kalıcı olarak yeni adrese yönlenir (canlı slug her zaman önceliklidir); silinen/bilinmeyen → 404
    const live = new Set<string>([...CATEGORIES.map((c) => c.slug), ...RESERVED_SLUGS, ...Object.keys(COLLECTIONS), ...((await getCategoryList().catch(() => [])).map((c) => c.slug))]);
    const cfg = await getCategoryConfig().catch(() => null);
    const to = cfg ? resolveRedirect(cfg.redirects, slug, live) : null;
    if (to) permanentRedirect(`/kategori/${to}`);
    notFound();
  }

  // Sunucu tarafı sayfalama: Çok Satanlar listesi (48, kendi mantığı) bellekte dilimlenir; diğerleri take/skip + ayrı sayım
  const path = `/kategori/${slug}`;
  let total: number;
  let all: Awaited<ReturnType<typeof getBestSellers>> | null = null;
  if (current.where) total = await countProductsCached(current.where);
  else {
    all = await getBestSellers(48);
    total = all.length;
  }
  const fix = canonicalListing(query, total);
  if (fix) redirect(pageHref(path, fix.page, query, fix.adet)); // geçersiz sayfa/adet → varsayılan, sınır dışı → son sayfa (404 yok)
  const { adet, size } = parseAdet(query.adet);
  const page = parsePage(query.sayfa);
  const pages = totalPages(total, size);
  const range = rangeOf(page, total, size);
  const products = all ? all.slice((page - 1) * size, page * size) : await getProductsCached(current.where!, size, (page - 1) * size);

  return (
    <main className="min-h-screen bg-white pb-20">
      <section className="bg-zinc-50 border-b border-zinc-200 py-12 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-3">
          <Breadcrumbs
            className="text-zinc-500 mb-2 flex justify-center"
            items={[{ name: "Ana Sayfa", href: "/" }, { name: current.title, href: `/kategori/${slug}` }]}
          />
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-zinc-900">{current.title}</h1>
          <p className="text-sm text-zinc-600 max-w-xl mx-auto">{current.desc}</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-zinc-200 pb-4 mb-6 text-xs text-zinc-500">
          <div className="flex items-center gap-4">
            <span>{range ? `${range.from}-${range.to} / ${range.total} ürün gösteriliyor` : "0 ürün listeleniyor"}</span>
            <span className="text-amber-700 font-medium hidden lg:inline">📍 Beyoğlu Mağazasında Sergilenen Modeller</span>
          </div>
          {total > 0 && <PageSizeLinks path={path} current={adet} page={page} size={size} params={query} />}
        </div>
        <Pagination path={path} page={page} pages={pages} params={query} label="Sayfalama (üst)" className="mb-8" />

        {products.length === 0 ? (
          <div className="bg-zinc-50 rounded-3xl border border-zinc-200 p-12 text-center max-w-md mx-auto space-y-3">
            <span className="text-3xl block" aria-hidden="true">💡</span>
            <h2 className="font-serif font-bold text-zinc-900 text-base">Bu listede henüz ürün yok</h2>
            <Link
              href="/kategori/tum"
              className="inline-block bg-zinc-900 hover:bg-amber-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors mt-2"
            >
              Tüm Ürünleri Gör
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 4} />
            ))}
          </div>
        )}
        <Pagination path={path} page={page} pages={pages} params={query} label="Sayfalama (alt)" />
      </section>
    </main>
  );
}

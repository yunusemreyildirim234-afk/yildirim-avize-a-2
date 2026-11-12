import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLadderContext } from "@/lib/showcase";
import ProductDetailClient from "@/components/ProductDetailClient";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductReviews from "@/components/ProductReviews";
import ProductQuestionForm from "@/components/ProductQuestionForm";
import ProductCard from "@/components/ProductCard";
import { getLiveStocks, getProductDetail, getProductsCached } from "@/lib/products";
import { applyLiveStock } from "@/lib/stock-freshness";
import { getUserSession } from "@/lib/account";
import { getStocklessRule } from "@/lib/visibility";
import { getLowStockSetting } from "@/lib/low-stock-setting";
import { isProductVisible } from "@/lib/stockless";
import { reviewEligibility, type ReviewEligibility } from "@/lib/reviews";
import JsonLd from "@/components/JsonLd";
import { CATEGORIES, SITE_URL } from "@/lib/site";
import { getCategoryList, getCategorySettings } from "@/lib/category-list";
import { isAccessoryCategory } from "@/lib/bulb-note";
import { categoryKey } from "@/lib/categories";
import { categoryDisplayTitle } from "@/lib/category-settings";
import { defaultOffer, feedBrand } from "@/lib/feed";
import { coverImageOf, imageListOf } from "@/lib/variation-input";
import { GtmEvent } from "@/components/GtmEvent";
import { gaItem, viewItemEvent } from "@/lib/gtm-events";
import { displayTitle } from "@/lib/title-display";

const totalStockOf = (p: { variations: { stock: number }[] }) => p.variations.reduce((sum, v) => sum + Math.max(0, v.stock), 0);

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductDetail(id); // önbellekli (60 sn), sayfayla aynı sonuç
  if (!product || !isProductVisible({ id: product.id, active: product.active, totalStock: totalStockOf(product), category: product.category }, await getStocklessRule())) return {};
  // Satır sonları/yinelenen boşluklar tek boşluğa indirilir (og:description ve meta açıklama düz metin olsun)
  const description =
    (product.description ?? "").replace(/\s+/g, " ").trim().slice(0, 160) || `${product.title} – Yıldırım Avize Beyoğlu Şişhane`;
  const cover = coverImageOf(product);
  return {
    title: displayTitle(product.title).title,
    description,
    alternates: { canonical: `/urun/${id}` },
    // og:type "product" Next'in tip listesinde yok: sayfa gövdesindeki <meta property="og:type"> ile (React başlığa taşır) verilir
    openGraph: {
      title: product.title,
      description,
      url: `/urun/${id}`,
      images: cover ? [{ url: cover, alt: product.title }] : undefined,
    },
    twitter: {
      card: "summary",
      title: product.title,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;

  // Veritabanından ilgili ürünü ve bağlı varyasyonlarını çekiyoruz
  // Ürün bilgisi 60 sn önbellekli (süre dolunca ilk ziyaretçiye eski veri sunulur); stok ise her istekte canlı okunup üzerine yazılır.
  // Canlı okuma hata verirse önbellekli stok kalır (sayfa açılır; sepet ve sipariş ucu stoğu zaten canlı doğrular).
  const cachedProduct = await getProductDetail(id);
  const product = cachedProduct ? applyLiveStock(cachedProduct, await getLiveStocks(id).catch(() => null)) : null;

  const ladderCtx = await getLadderContext();

  // Görünürlük: aktif ürün VEYA (ayar açık + pasif + toplam stok 0) — kural lib/stockless.ts, vitrin sorgularıyla aynı
  if (!product || !isProductVisible({ id: product.id, active: product.active, totalStock: totalStockOf(product), category: product.category }, await getStocklessRule())) {
    notFound();
  }

  const hasCategory = product.category.trim().length > 0; // kategorisiz ürün: benzer ürün / kategori yolu / kategori alanı yok
  const similar = hasCategory ? await getProductsCached({ active: true, variations: { some: { stock: { gt: 0 } } }, category: product.category, id: { not: product.id } }, 4).catch(() => []) : [];

  const userSession = await getUserSession();
  const eligibility: ReviewEligibility | "guest" = userSession?.uid ? await reviewEligibility(userSession.uid, product.id) : "guest";
  const reviews = product.reviews.map((r) => {
    const [first, ...rest] = r.user.name.trim().split(/\s+/);
    return {
      id: r.id,
      author: rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first,
      rating: r.rating,
      comment: r.comment,
      imageUrl: r.imageUrl,
      verified: r.verified,
      createdAt: r.createdAt,
    };
  });
  const ratingAvg = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const category = hasCategory ? CATEGORIES.find((c) => c.dbCategory === product.category) : undefined;
  const categorySettings = await getCategorySettings();
  // Kategori sayfası adresi (etiket ve breadcrumb AYNI hedef): sabit kategori slug'ı; dinamik kategori listeden anahtarla bulunur; liste alınamazsa yalnızca sabit
  const catKey = hasCategory ? categoryKey(product.category) : "";
  const catEntry = hasCategory ? await getCategoryList().then((l) => l.find((c) => c.key === catKey)).catch(() => undefined) : undefined;
  const fixedCat = category ?? CATEGORIES.find((c) => categoryKey(c.dbCategory) === catKey);
  const categoryHref = catEntry ? `/kategori/${catEntry.slug}` : fixedCat ? `/kategori/${fixedCat.slug}` : undefined;
  // Fiyat/stok/marka Google feed'iyle (lib/feed.ts) ve sayfadaki varsayılan seçimle AYNI kaynaktan gelir
  const offer = defaultOffer(product);
  const productImages = imageListOf(product).map((u) => (u.startsWith("/") ? `${SITE_URL}${u}` : u)); // kapak önde (og:image/kart/feed ile aynı kural)
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || product.title,
    ...(hasCategory ? { category: product.category } : {}),
    brand: { "@type": "Brand", name: feedBrand() },
    url: `${SITE_URL}/urun/${id}`,
    ...(productImages.length ? { image: productImages.slice(0, 6) } : {}),
    ...(product.modelCode ? { sku: product.modelCode } : {}),
    ...(reviews.length
      ? {
          aggregateRating: { "@type": "AggregateRating", ratingValue: ratingAvg.toFixed(1), reviewCount: reviews.length },
          review: reviews.slice(0, 10).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.author },
            datePublished: r.createdAt.slice(0, 10),
            reviewBody: r.comment,
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
          })),
        }
      : {}),
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/urun/${id}`,
      priceCurrency: "TRY",
      price: offer.price,
      seller: { "@type": "Organization", name: "Yıldırım Avize" },
      availability: offer.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <main className="min-h-screen bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
      <meta property="og:type" content="product" />
      <div className="max-w-6xl mx-auto">
        <JsonLd data={productSchema} />
        <GtmEvent event={viewItemEvent([gaItem({ id: product.id, name: product.title, price: offer.price, category: product.category, brand: feedBrand(), variant: offer.variation?.variationValue })])} />
        <Breadcrumbs
          className="text-neutral-500 mb-8"
          items={[
            { name: "Ana Sayfa", href: "/" },
            ...(category
              ? [{ name: categoryDisplayTitle(categorySettings, categoryKey(category.dbCategory), category.title), href: categoryHref }]
              : hasCategory
                ? [{ name: `${product.category} Avizeler`, ...(categoryHref ? { href: categoryHref } : {}) }]
                : []),
            { name: displayTitle(product.title).title },
          ]}
        />

        {/* İstemci Tarafı İnteraktif Detay Bileşeni */}
        <ProductDetailClient product={product} ladderCtx={ladderCtx} categoryHref={categoryHref} lowStock={await getLowStockSetting()} />

        {similar.length > 0 && (
          <section aria-labelledby="benzer" className="mt-10">
            {/* Aksesuarlarda (avize taşı vb.) "Benzer Avize Modelleri" başlığı görünmez; ekran okuyucu için bölüm adı kalır */}
            <h2 id="benzer" className={isAccessoryCategory(product.category) ? "sr-only" : "text-lg font-serif font-bold text-neutral-900 mb-4"}>
              {isAccessoryCategory(product.category) ? "Benzer Ürünler" : "Benzer Avize Modelleri"}
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {similar.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        <div className="mt-8">
          <ProductReviews productId={product.id} reviews={reviews} eligibility={eligibility} />
        </div>

        <div className="mt-8">
          <ProductQuestionForm productId={product.id} productTitle={product.title} />
        </div>
      </div>
    </main>
  );
}
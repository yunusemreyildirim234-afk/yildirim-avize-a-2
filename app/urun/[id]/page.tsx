import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getLadderContext } from "@/lib/showcase";
import ProductDetailClient from "@/components/ProductDetailClient";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductReviews from "@/components/ProductReviews";
import ProductQuestionForm from "@/components/ProductQuestionForm";
import ProductCard from "@/components/ProductCard";
import ProductStrip from "@/components/ProductStrip";
import { loadSimilarProducts } from "@/lib/similar-products";
import { ProductPageComplements } from "@/components/ComplementSuggestions";
import { getProductComplements } from "@/lib/complement-suggestions";
import { getLiveStocks, getProductDetail, getProductIdsByShort } from "@/lib/products";
import { parseProductParam, productPath } from "@/lib/product-url";
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
import { JSONLD_DESCRIPTION_MAX, gtin13Of, offerExtras, productMetaDescription, productSeoTitle, truncateAtWord } from "@/lib/product-seo";

const totalStockOf = (p: { variations: { stock: number }[] }) => p.variations.reduce((sum, v) => sum + Math.max(0, v.stock), 0);

interface Props {
  params: Promise<{ id: string }>;
}

/** Adres parametresi → tam ürün kimliği. Eski uuid doğrudan; /urun/{ad}-{8 hex} kısa kimlikle (tek eşleşme şart); bozuk/çoklu/yok → null (404). */
async function resolveProductId(param: string): Promise<string | null> {
  const parsed = parseProductParam(param);
  if (parsed.kind === "legacy-uuid") return parsed.id;
  if (parsed.kind === "bad") return null;
  const ids = await getProductIdsByShort(parsed.short);
  return ids.length === 1 ? ids[0] : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: param } = await params;
  const id = await resolveProductId(param);
  const product = id ? await getProductDetail(id) : null; // önbellekli (60 sn), sayfayla aynı sonuç
  if (!product || !isProductVisible({ id: product.id, active: product.active, totalStock: totalStockOf(product), category: product.category }, await getStocklessRule())) return {};
  // Temiz başlık (displayTitle): <title>, OG, Twitter ve JSON-LD aynı kaynaktan; meta açıklama lib/product-seo.ts şablonundan (≤160, kelime sınırında)
  const cleanTitle = displayTitle(product.title).title;
  const canonical = productPath(product); // kanonik adres: istek eski uuid/yanlış ad olsa da aynı
  const description = productMetaDescription({
    cleanTitle,
    price: defaultOffer(product).price,
    category: product.category,
    pickupDiscountPct: product.pickupDiscountPct,
  });
  const cover = coverImageOf(product);
  return {
    title: productSeoTitle(cleanTitle),
    description,
    alternates: { canonical },
    // og:type "product" Next'in tip listesinde yok: sayfa gövdesindeki <meta property="og:type"> ile (React başlığa taşır) verilir
    openGraph: {
      title: cleanTitle,
      description,
      url: canonical,
      images: cover ? [{ url: cover, alt: cleanTitle }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: cleanTitle,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { id: param } = await params;
  const id = await resolveProductId(param);

  // Veritabanından ilgili ürünü ve bağlı varyasyonlarını çekiyoruz
  // Ürün bilgisi 60 sn önbellekli (süre dolunca ilk ziyaretçiye eski veri sunulur); stok ise her istekte canlı okunup üzerine yazılır.
  // Canlı okuma hata verirse önbellekli stok kalır (sayfa açılır; sepet ve sipariş ucu stoğu zaten canlı doğrular).
  const cachedProduct = id ? await getProductDetail(id) : null;
  const product = id && cachedProduct ? applyLiveStock(cachedProduct, await getLiveStocks(id).catch(() => null)) : null;

  const ladderCtx = await getLadderContext();

  // Görünürlük: aktif ürün VEYA (ayar açık + pasif + toplam stok 0) — kural lib/stockless.ts, vitrin sorgularıyla aynı
  if (!product || !isProductVisible({ id: product.id, active: product.active, totalStock: totalStockOf(product), category: product.category }, await getStocklessRule())) {
    notFound();
  }

  // Kanonik adres dışındaki her istek (eski uuid, eski/yanlış ad, büyük harf) tek sıçramayla 308 alır; kanonik adres asla yönlendirmez (döngü yok).
  // Görünmeyen/yok ürün yukarıda 404 aldı, yani yönlendirme ürünün varlığını sızdırmaz.
  const canonicalPath = productPath(product);
  let requested = param;
  try {
    requested = decodeURIComponent(param);
  } catch {}
  if (`/urun/${requested}` !== canonicalPath) permanentRedirect(canonicalPath);

  const hasCategory = product.category.trim().length > 0; // kategorisiz ürün: benzer ürün / kategori yolu / kategori alanı yok
  // Benzer ürünler: aynı kategori, aktif ve stoklu (kendi ürün hariç); paylaşılan katalog önbelleğinden, ilk 8 sunucuda hazır, kalanı şeritte kaydırdıkça gelir
  const similar = hasCategory ? await loadSimilarProducts(product.category, product.id, 0).catch(() => null) : null;

  // "Bununla birlikte alın": bağ yoksa boş (bölüm hiç çizilmez); okunamazsa sayfa yine açılır
  const complements = await getProductComplements(product.id).catch(() => ({ suggestions: [], count: null }));

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
    name: displayTitle(product.title).title,
    description: truncateAtWord(product.description || product.title, JSONLD_DESCRIPTION_MAX),
    ...(hasCategory ? { category: product.category } : {}),
    brand: { "@type": "Brand", name: feedBrand() },
    url: `${SITE_URL}${canonicalPath}`,
    ...(productImages.length ? { image: productImages.slice(0, 6) } : {}),
    ...(product.modelCode ? { sku: product.modelCode } : {}),
    ...gtin13Of(offer.variation?.barcode),
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
      url: `${SITE_URL}${canonicalPath}`,
      priceCurrency: "TRY",
      price: offer.price,
      seller: { "@type": "Organization", name: "Yıldırım Avize" },
      availability: offer.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      ...offerExtras({ price: offer.price, siteUrl: SITE_URL }),
    },
  };

  return (
    <main className="min-h-screen bg-canvas py-12 px-4 sm:px-6 lg:px-8">
      <meta property="og:type" content="product" />
      <div className="max-w-6xl mx-auto">
        <JsonLd data={productSchema} />
        <GtmEvent event={viewItemEvent([gaItem({ id: product.id, name: product.title, price: offer.price, category: product.category, brand: feedBrand(), variant: offer.variation?.variationValue })])} />
        <Breadcrumbs
          className="text-ink-muted mb-8"
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

        <ProductPageComplements suggestions={complements.suggestions} count={complements.count} />

        {similar && similar.items.length > 0 && (
          <section aria-labelledby="benzer" className="mt-10">
            {/* Aksesuarlarda (avize taşı vb.) "Benzer Avize Modelleri" başlığı görünmez; ekran okuyucu için bölüm adı kalır */}
            <h2 id="benzer" className={isAccessoryCategory(product.category) ? "sr-only" : "text-lg font-serif font-bold text-ink mb-4"}>
              {isAccessoryCategory(product.category) ? "Benzer Ürünler" : "Benzer Avize Modelleri"}
            </h2>
            <ProductStrip
              initial={similar.items.map((p) => ({ id: p.id, node: <ProductCard key={p.id} product={p} /> }))}
              initialCursor={similar.cursor}
              initialHasMore={similar.hasMore}
              category={product.category}
              excludeId={product.id}
              label={isAccessoryCategory(product.category) ? "Benzer ürünler" : "Benzer avize modelleri"}
            />
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
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ProductDetailClient from "@/components/ProductDetailClient";
import { cookies } from "next/headers";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductReviews from "@/components/ProductReviews";
import ProductQuestionForm from "@/components/ProductQuestionForm";
import { USER_COOKIE, verifySession } from "@/lib/session";
import JsonLd from "@/components/JsonLd";
import { CATEGORIES, SITE_URL } from "@/lib/site";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return {};
  const description =
    product.description?.slice(0, 160) || `${product.title} – Yıldırım Avize Beyoğlu Şişhane`;
  return {
    title: product.title,
    description,
    alternates: { canonical: `/urun/${id}` },
    openGraph: {
      type: "website",
      title: product.title,
      description,
      url: `/urun/${id}`,
      images: product.imageUrl ? [{ url: product.imageUrl, alt: product.title }] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;

  // Veritabanından ilgili ürünü ve bağlı varyasyonlarını çekiyoruz
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variations: true,
      reviews: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  });

  if (!product) {
    notFound();
  }

  const loggedIn = Boolean(await verifySession((await cookies()).get(USER_COOKIE)?.value));
  const reviews = product.reviews.map((r) => {
    const [first, ...rest] = r.user.name.trim().split(/s+/);
    return {
      id: r.id,
      author: rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first,
      rating: r.rating,
      comment: r.comment,
      verified: r.verified,
      createdAt: r.createdAt.toISOString(),
    };
  });
  const ratingAvg = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const category = CATEGORIES.find((c) => c.dbCategory === product.category);
  const inStock = product.variations.some((v) => v.stock > 0);
  const prices = product.variations.map((v) => product.basePrice + v.extraPrice);
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || product.title,
    category: product.category,
    brand: { "@type": "Brand", name: "Yıldırım Avize" },
    ...(product.imageUrl ? { image: [product.imageUrl] } : {}),
    ...(reviews.length
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: ratingAvg.toFixed(1), reviewCount: reviews.length } }
      : {}),
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/urun/${id}`,
      priceCurrency: "TRY",
      price: Math.min(product.basePrice, ...prices),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <main className="min-h-screen bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <JsonLd data={productSchema} />
        <Breadcrumbs
          className="text-neutral-500 mb-8"
          items={[
            { name: "Ana Sayfa", href: "/" },
            ...(category
              ? [{ name: category.title, href: `/kategori/${category.slug}` }]
              : [{ name: `${product.category} Avizeler` }]),
            { name: product.title },
          ]}
        />

        {/* İstemci Tarafı İnteraktif Detay Bileşeni */}
        <ProductDetailClient product={product} />

        <div className="mt-8">
          <ProductReviews productId={product.id} reviews={reviews} loggedIn={loggedIn} />
        </div>

        <div className="mt-8">
          <ProductQuestionForm productId={product.id} productTitle={product.title} />
        </div>
      </div>
    </main>
  );
}
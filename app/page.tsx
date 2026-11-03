import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import FaqSection from "@/components/FaqSection";
import Hero from "@/components/Hero";
import PromoStrip from "@/components/PromoStrip";
import JsonLd from "@/components/JsonLd";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/products";
import { composeSection } from "@/lib/homepage-compose";
import { getHomepageConfig, getSectionPools } from "@/lib/homepage";
import type { ProductWithVariations } from "@/lib/products";
import { ADDRESS_LINE, CATEGORIES, LAT, LNG, PHONE_TEL, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Yıldırım Avize | Beyoğlu Şişhane Kristal, Modern & Klasik Avize" },
  description:
    "Beyoğlu Şişhane'deki merkezimizden kristal, modern ve klasik avizeler. Üst düzey korumalı koliyle kargo veya mağazadan teslim.",
  alternates: { canonical: "/" },
};

const localBusiness = {
  "@context": "https://schema.org",
  "@type": "LightingStore",
  name: "Yıldırım Avize",
  url: SITE_URL,
  telephone: PHONE_TEL,
  priceRange: "₺₺",
  geo: { "@type": "GeoCoordinates", latitude: LAT, longitude: LNG },
  address: {
    "@type": "PostalAddress",
    streetAddress: ADDRESS_LINE.split(", Şişhane")[0],
    addressLocality: "Beyoğlu",
    addressRegion: "İstanbul",
    addressCountry: "TR",
  },
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "09:00",
    closes: "18:00",
  },
  sameAs: [
    "https://www.instagram.com/yildirimavize/",
    "https://www.facebook.com/y.ld.r.m.avize/",
    "https://www.trendyol.com/magaza/yildirimavize-m-379320",
    "https://www.hepsiburada.com/magaza/yildirim-avize",
  ],
};

/** Bölümde ilk `count` ürünün altındaki "Daha fazla göster" (yerel <details>; kapalıyken kart görselleri yüklenmez). */
function MoreCards({ products, cols, dark = false }: { products: ProductWithVariations[]; cols: string; dark?: boolean }) {
  if (products.length === 0) return null;
  return (
    <details className="group mt-6 sm:mt-8">
      <summary
        className={`list-none cursor-pointer mx-auto w-fit text-xs font-semibold px-6 py-3 rounded-full transition-colors group-open:hidden focus-visible:outline-2 focus-visible:outline-amber-600 ${
          dark ? "text-white border border-white/40 hover:bg-white hover:text-zinc-900" : "text-zinc-800 border border-zinc-300 hover:border-amber-600 hover:text-amber-800"
        }`}
      >
        Daha fazla göster ({products.length})
      </summary>
      <div className={`grid ${cols} gap-4 sm:gap-6`}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} dark={dark} />
        ))}
      </div>
    </details>
  );
}

export default async function Home() {
  // Bölüm havuzları ve yönetici ayarı (istek başına bir kez); ayar yoksa/bozuksa bugünkü sıralama ve sayılar
  const [config, pools, ...categoryCovers] = await Promise.all([
    getHomepageConfig(),
    getSectionPools(),
    ...CATEGORIES.slice(0, 4).map((c) => getProducts({ category: c.dbCategory, imageUrl: { not: null } }, 1)),
  ]);
  const { shown: featured, more: moreFeatured } = composeSection(pools.featured, config.featured, pools.featuredManual);
  const { shown: discounted, more: moreDiscounted } = composeSection(pools.discounted, config.discounted);
  const { shown: bestSellers, more: moreBestSellers } = composeSection(pools.bestsellers, config.bestsellers);

  return (
    <main>
      <JsonLd data={localBusiness} />

      {/* 1. Ferah beyaz zemin: merkezi marka + arama */}
      <Hero />

      {/* Avantajlar: kupon, ücretsiz kargo, mağazadan teslim (yönetim panelinden düzenlenir) */}
      <PromoStrip />

      {/* 2. Beyaz -> açık gri: koleksiyonlar ve öne çıkanlar */}
      <section className="bg-gradient-to-b from-white via-zinc-50 to-zinc-100 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto space-y-16">
          <div>
            <div className="text-center mb-8 space-y-2">
              <span className="text-xs uppercase tracking-widest text-amber-700 font-semibold">Koleksiyonlar</span>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-zinc-900">Aydınlatma Koleksiyonları</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {CATEGORIES.slice(0, 4).map((c, i) => {
                const cover = categoryCovers[i]?.[0]?.imageUrl;
                return (
                  <Link
                    key={c.slug}
                    href={`/kategori/${c.slug}`}
                    className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-zinc-200 border border-zinc-200"
                  >
                    {cover && (
                      <Image
                        src={cover}
                        alt={c.title}
                        fill
                        sizes="(min-width: 1024px) 25vw, 50vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/75 via-zinc-950/10 to-transparent" />
                    <div className="absolute bottom-0 p-4 sm:p-5 text-white">
                      <h3 className="font-serif font-bold text-base sm:text-lg leading-tight">{c.title}</h3>
                      <span className="text-xs text-zinc-200">Keşfet →</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between mb-8 gap-4">
              <div className="space-y-2">
                <span className="text-xs uppercase tracking-widest text-amber-700 font-semibold">Vitrin</span>
                <h2 className="text-2xl sm:text-3xl font-serif font-bold text-zinc-900">Öne Çıkan Ürünler</h2>
              </div>
              <Link href="/kategori/one-cikanlar" className="text-xs font-semibold text-zinc-700 hover:text-amber-700 shrink-0">
                Tümünü Gör →
              </Link>
            </div>
            {featured.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-10">Ürünler yakında burada olacak.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {featured.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 2} />
                ))}
              </div>
            )}
            <MoreCards products={moreFeatured} cols="grid-cols-2 md:grid-cols-3 lg:grid-cols-4" />
          </div>
        </div>
      </section>

      {/* 3. Açık gri -> koyu gri: indirimli & fırsat ürünleri */}
      <section className="bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-800 dark:from-[#18181b] dark:via-[#1f1f23] dark:to-[#27272a] px-4 sm:px-6 lg:px-8 pt-16 pb-24 sm:pb-28">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 space-y-2">
            <span className="text-xs uppercase tracking-widest text-red-700 font-semibold">Fırsatlar</span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-zinc-900">İndirimli & Fırsat Ürünleri</h2>
          </div>
          {discounted.length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-10">Şu an indirimli ürün bulunmuyor.</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {discounted.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
          <MoreCards products={moreDiscounted} cols="grid-cols-2 lg:grid-cols-4" />
          <div className="text-center mt-10">
            <Link
              href="/kategori/indirimli"
              className="keep-theme inline-block text-xs font-semibold text-white border border-white/40 hover:bg-white hover:text-zinc-900 px-6 py-3 rounded-full transition-colors"
            >
              Tüm Fırsat Ürünleri →
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Antrasit: çok satanlar (İndirimlilerin hemen altında) */}
      {bestSellers.length > 0 && (
        <section className="keep-theme bg-zinc-800 px-4 sm:px-6 lg:px-8 pb-20 sm:pb-24">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8 space-y-2">
              <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold">Müşterilerin Tercihi</span>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white">Çok Satanlar</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {bestSellers.map((p) => (
                <ProductCard key={p.id} product={p} dark />
              ))}
            </div>
            <MoreCards products={moreBestSellers} cols="grid-cols-2 lg:grid-cols-4" dark />
            <div className="text-center mt-10">
              <Link
                href="/kategori/cok-satanlar"
                className="inline-block text-xs font-semibold text-white border border-white/40 hover:bg-white hover:text-zinc-900 px-6 py-3 rounded-full transition-colors"
              >
                Tüm Çok Satanlar →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 5. Antrasit -> siyah: SSS */}
      <div className="keep-theme bg-gradient-to-b from-zinc-800 via-zinc-900 to-black">
        <FaqSection />
      </div>
    </main>
  );
}

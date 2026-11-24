import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import FaqSection from "@/components/FaqSection";
import Hero from "@/components/Hero";
import PromoStrip from "@/components/PromoStrip";
import JsonLd from "@/components/JsonLd";
import ProductCard from "@/components/ProductCard";
import CollectionsRow from "@/components/CollectionsRow";
import { getHomeCollections } from "@/lib/home-collections";
import { composeSection, inStockOnly } from "@/lib/homepage-compose";
import { getHomepageConfig, getSectionPools } from "@/lib/homepage";
import MoreProducts from "@/components/MoreProducts";
import { ADDRESS_LINE, LAT, LNG, PHONE_TEL, SITE_URL, SOCIAL_LINKS } from "@/lib/site";
import { isBlobImage, smallImage } from "@/lib/img";

export const revalidate = 60; // Genel (kişiselleştirmesiz) sayfa: 60 sn önbellek; yönetici işlemleri revalidateStorefront() ile anında yeniler

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
  logo: `${SITE_URL}/logo-kare-v2.png`,
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
    SOCIAL_LINKS.instagram,
    SOCIAL_LINKS.tiktok,
    SOCIAL_LINKS.youtube,
    SOCIAL_LINKS.facebook,
    "https://www.trendyol.com/magaza/yildirimavize-m-379320",
    "https://www.hepsiburada.com/magaza/yildirim-avize",
  ],
};

/** Bölümde ilk `count` ürünün altındaki "Daha fazla göster": kalan ürünler HTML'e gömülmez, tıklanınca getirilir (components/MoreProducts.tsx). */
function MoreCards({ section, total, cols, href, dark = false }: { section: string; total: number; cols: string; href: string; dark?: boolean }) {
  return <MoreProducts section={section} total={total} cols={cols} fallbackHref={href} dark={dark} />;
}

export default async function Home() {
  // Bölüm havuzları ve yönetici ayarı (istek başına bir kez); ayar yoksa/bozuksa bugünkü sıralama ve sayılar
  const [config, pools, collections] = await Promise.all([getHomepageConfig(), getSectionPools(), getHomeCollections()]);
  const { shown: featured, more: moreFeatured } = composeSection(pools.featured, config.featured, pools.featuredManual);
  const { shown: discounted, more: moreDiscounted } = composeSection(inStockOnly(pools.discounted), config.discounted);
  const { shown: bestSellers, more: moreBestSellers } = composeSection(pools.bestsellers, config.bestsellers);

  return (
    <main>
      <JsonLd data={localBusiness} />

      {/* 1. Ferah beyaz zemin: merkezi marka + arama */}
      <Hero />

      {/* Avantajlar: kupon, ücretsiz kargo, mağazadan teslim (yönetim panelinden düzenlenir) */}
      <PromoStrip />

      {/* 2. Beyaz -> açık gri: koleksiyonlar ve öne çıkanlar */}
      <section className="bg-canvas px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto space-y-16">
          <div>
            <div className="text-center mb-8 space-y-2">
              <span className="text-xs uppercase tracking-widest text-bronze-ink font-semibold">Koleksiyonlar</span>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-ink">Aydınlatma Koleksiyonları</h2>
            </div>
            <CollectionsRow count={collections.length}>
              {collections.map((c) => {
                const cover = c.cover;
                return (
                  <Link
                    key={c.slug}
                    role="listitem"
                    href={`/kategori/${c.slug}`}
                    data-testid="koleksiyon-kart"
                    className="group flex flex-col rounded-2xl overflow-hidden bg-raised border border-line shrink-0 snap-start w-[calc(50%-8px)] lg:w-[calc(25%-12px)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink"
                  >
                    {/* Fotoğraf alanı: oran (4/5) ve kırpma (object-cover) eskisiyle aynı; yazı artık fotoğrafın üstünde değil */}
                    <div className="relative aspect-[4/5] overflow-hidden bg-surface">
                      {cover && (
                        <Image
                          src={smallImage(cover)}
                          unoptimized={isBlobImage(cover)}
                          alt={c.title}
                          fill
                          sizes="(min-width: 1024px) 25vw, 50vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      )}
                    </div>
                    {/* Düz zeminli başlık şeridi: açık temada beyaz/koyu yazı, koyu temada renk ölçeği ters döner. Uzun başlık kesilmez, alt satıra iner. */}
                    <div className="flex-1 border-t border-line bg-raised px-3 py-3 sm:px-4 sm:py-3.5">
                      <h3 className="font-serif font-bold text-sm sm:text-lg leading-snug text-ink break-words">{c.title}</h3>
                      <span className="mt-1 block text-xs font-semibold text-bronze-ink group-hover:underline">Keşfet →</span>
                    </div>
                  </Link>
                );
              })}
            </CollectionsRow>
          </div>

          <div>
            <div className="flex items-end justify-between mb-8 gap-4">
              <div className="space-y-2">
                <span className="text-xs uppercase tracking-widest text-bronze-ink font-semibold">Vitrin</span>
                <h2 className="text-2xl sm:text-3xl font-serif font-bold text-ink">Öne Çıkan Ürünler</h2>
              </div>
              <Link href="/kategori/one-cikanlar" className="text-xs font-semibold text-ink-muted hover:text-bronze-ink shrink-0">
                Tümünü Gör →
              </Link>
            </div>
            {featured.length === 0 ? (
              <p className="text-sm text-ink-muted text-center py-10">Ürünler yakında burada olacak.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {featured.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 2} />
                ))}
              </div>
            )}
            <MoreCards section="featured" total={moreFeatured.length} href="/kategori/one-cikanlar" cols="grid-cols-2 md:grid-cols-3 lg:grid-cols-4" />
          </div>
        </div>
      </section>

      {/* 3. Canvas: indirimli & fırsat ürünleri (ince çizgiyle ayrılır; Öne Çıkan ve Çok Satanlar ile aynı zemin); stoklu ürün yoksa bant gizlenir */}
      {discounted.length > 0 && (
      <section className="bg-canvas border-t border-line px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 space-y-2">
            <span className="text-xs uppercase tracking-widest text-sale font-semibold">Fırsatlar</span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-ink">İndirimli & Fırsat Ürünleri</h2>
          </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {discounted.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          <MoreCards section="discounted" total={moreDiscounted.length} href="/kategori/indirimli" cols="grid-cols-2 lg:grid-cols-4" />
          <div className="text-center mt-10">
            <Link
              href="/kategori/indirimli"
              className="inline-block text-xs font-semibold text-ink border border-line-strong hover:bg-ink hover:text-canvas px-6 py-3 rounded-full transition-colors"
            >
              Tüm Fırsat Ürünleri →
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* 4. Canvas: çok satanlar (İndirimlilerin hemen altında) */}
      {bestSellers.length > 0 && (
        <section className="bg-canvas border-t border-line px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8 space-y-2">
              <span className="text-xs uppercase tracking-widest text-bronze-ink font-semibold">Müşterilerin Tercihi</span>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-ink">Çok Satanlar</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {bestSellers.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <MoreCards section="bestsellers" total={moreBestSellers.length} href="/kategori/cok-satanlar" cols="grid-cols-2 lg:grid-cols-4" />
            <div className="text-center mt-10">
              <Link
                href="/kategori/cok-satanlar"
                className="inline-block text-xs font-semibold text-ink border border-line-strong hover:bg-ink hover:text-canvas px-6 py-3 rounded-full transition-colors"
              >
                Tüm Çok Satanlar →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 5. Surface: SSS (altındaki koyu footer ile net ayrım) */}
      <div className="bg-surface border-t border-line">
        <FaqSection />
      </div>
    </main>
  );
}

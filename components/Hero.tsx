import Image from "next/image";
import Link from "next/link";
import { isBlobImage, smallImage } from "@/lib/img";

// Vitrin hero: metin + tek avize fotoğrafı. Fotoğraf, Öne Çıkan Ürünler'in ilk stoklu ürününün kapağıdır (app/page.tsx seçer; geçici).
// Gerçek mağaza fotoğrafı gelince `image` yerine sabit bir görsel verilir. Fotoğraf yoksa tek sütun, ortalı düzen.
// Arama ve kategori bağlantıları Navbar'dadır (masaüstü NavSearch + kategori satırı, mobil arama simgesi + kategori şeridi).
export type HeroImage = { src: string; alt: string };

const btnBase =
  "inline-flex items-center justify-center min-h-11 px-6 rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink";

export default function Hero({ image = null }: { image?: HeroImage | null }) {
  return (
    <section className="bg-canvas text-ink px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:min-h-[68vh] lg:flex lg:items-center">
      <div className={`w-full mx-auto ${image ? "max-w-7xl grid gap-8 lg:grid-cols-2 lg:gap-14 items-center" : "max-w-3xl text-center"}`}>
        {image && (
          <div className="relative overflow-hidden rounded-2xl bg-photo border border-line aspect-[4/3] max-h-[38vh] w-full lg:order-2 lg:aspect-[4/5] lg:max-h-none">
            <Image
              src={smallImage(image.src)}
              unoptimized={isBlobImage(image.src)}
              alt={image.alt}
              fill
              priority
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-contain mix-blend-multiply dark:mix-blend-normal"
            />
          </div>
        )}

        <div className={image ? "text-center lg:text-left lg:order-1" : ""}>
          <h1 className="font-serif text-ink">
            <span className="block text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-[0.12em]">Yıldırım Avize</span>
            <span className="sr-only"> — </span>
            <span className="mt-3 block text-lg sm:text-xl font-bold tracking-normal text-ink-muted">Kristal, klasik ve modern avizeler</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-ink-muted max-w-xl mx-auto lg:mx-0">
            Beyoğlu Şişhane&apos;den Türkiye&apos;ye kristal, modern ve klasik avizeler.
          </p>
          <div className={`mt-7 flex flex-col sm:flex-row gap-3 ${image ? "sm:justify-center lg:justify-start" : "sm:justify-center"}`}>
            <Link href="/kategori/tum" className={`${btnBase} bg-ink text-canvas hover:bg-ink/90`}>
              Tüm ürünleri gör
            </Link>
            <Link href="/iletisim" className={`${btnBase} border border-line-strong text-ink hover:border-bronze hover:text-bronze-ink`}>
              Mağazayı ziyaret et
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

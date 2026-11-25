import Image from "next/image";
import Link from "next/link";

// Vitrin hero: sabit salon fotoğrafı (public/hero/salon-avize.webp, 1920×1072) tüm alanı kaplar; metin alt yarıda ortalıdır.
// Fotoğraf üstü renkler tema-bağımsız jetonlardır (on-photo, scrim): açık ve koyu temada hero aynı görünür.
// Alttan yukarı koyulaşan scrim, metnin bulunduğu bölgede fotoğraf ne kadar açık olursa olsun beyaz metne ≥4.5:1 kontrast verir.
// Mobilde hero 62svh (440–620 px) olduğu için alt kenarı sabit WhatsApp/telefon düğmelerinin (viewport'un alt ~120 px'i) üstünde biter; düğmeler yan yana, <340 px'te alt alta sarar.
// Arama ve kategori bağlantıları Navbar'dadır.
// Bu fotoğraf sayfanın LCP öğesidir: preload + fetchPriority="high", lazy değil. sizes bilerek 100vw: dikey ekranda object-cover görseli ekrandan geniş çizer,
// gerçek çizim genişliğini yazmak mobilde daha büyük dosya indirtirdi.

const btnBase =
  "inline-flex items-center justify-center min-h-11 rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-photo";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-night h-[62svh] min-h-[440px] max-h-[620px] md:h-[82vh] md:min-h-[540px] md:max-h-[860px]">
      <Image
        src="/hero/salon-avize.webp"
        alt="Altın rengi avizenin aydınlattığı modern bir oturma odası"
        fill
        preload
        fetchPriority="high"
        sizes="100vw"
        quality={60}
        className="object-cover object-[42%_30%] md:object-[50%_12%]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-scrim/80 from-0% via-scrim/60 via-55% to-transparent" />

      <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 pb-6 md:pb-16 text-center text-on-photo">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-serif">
            <span className="block text-[1.625rem] sm:text-4xl md:text-5xl lg:text-6xl font-normal uppercase tracking-[0.1em] sm:tracking-[0.14em]">Yıldırım Avize</span>
            <span className="sr-only"> — </span>
            <span className="mt-2 block text-base sm:text-xl font-normal tracking-normal">Kristal, klasik ve modern avizeler</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base">Beyoğlu Şişhane&apos;den Türkiye&apos;ye kristal, modern ve klasik avizeler.</p>
          <div className="mt-5 sm:mt-6 mx-auto flex max-w-sm sm:max-w-none flex-wrap items-center justify-center gap-3">
            <Link href="/kategori/tum" className={`${btnBase} flex-1 min-w-[9.5rem] sm:flex-none px-4 py-3 sm:px-6 sm:py-0 bg-on-photo text-night hover:bg-on-photo/90`}>
              Tüm ürünleri gör
            </Link>
            <Link
              href="/iletisim"
              className={`${btnBase} flex-1 min-w-[9.5rem] sm:flex-none px-4 py-3 sm:px-6 sm:py-0 border border-on-photo text-on-photo bg-scrim/25 backdrop-blur-sm hover:bg-scrim/40`}
            >
              Mağazayı ziyaret et
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

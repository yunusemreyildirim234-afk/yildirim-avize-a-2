import Image from "next/image";
import Link from "next/link";

// Vitrin hero: sabit salon fotoğrafı (public/hero/salon-avize.webp, 1920×1072) tüm alanı kaplar; metin alt yarıda ortalıdır.
// Fotoğraf üstü renkler tema-bağımsız jetonlardır (on-photo, scrim): açık ve koyu temada hero aynı görünür.
// Alttan yukarı koyulaşan scrim, metnin bulunduğu bölgede fotoğraf ne kadar açık olursa olsun beyaz metne ≥4.5:1 kontrast verir.
// Mobilde metin bloğu alt kenardan 56 px yukarıda biter: sağ alttaki sabit WhatsApp/telefon düğmeleri (viewport'un alt ~120 px'i) düğmeleri örtmez.
// Arama ve kategori bağlantıları Navbar'dadır.

const btnBase =
  "inline-flex items-center justify-center min-h-11 px-6 rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-photo";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-night h-[78svh] min-h-[460px] md:h-[82vh] md:min-h-[540px] md:max-h-[860px]">
      <Image
        src="/hero/salon-avize.webp"
        alt="Altın rengi avizenin aydınlattığı modern bir oturma odası"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[42%_30%] md:object-[50%_12%]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-scrim/80 from-0% via-scrim/60 via-55% to-transparent" />

      <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 pb-14 md:pb-16 text-center text-on-photo">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-serif">
            <span className="block text-3xl sm:text-5xl lg:text-6xl font-normal uppercase tracking-[0.1em] sm:tracking-[0.14em]">Yıldırım Avize</span>
            <span className="sr-only"> — </span>
            <span className="mt-2 block text-base sm:text-xl font-normal tracking-normal">Kristal, klasik ve modern avizeler</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base">Beyoğlu Şişhane&apos;den Türkiye&apos;ye kristal, modern ve klasik avizeler.</p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/kategori/tum" className={`${btnBase} w-full sm:w-auto max-w-xs bg-on-photo text-night hover:bg-on-photo/90`}>
              Tüm ürünleri gör
            </Link>
            <Link
              href="/iletisim"
              className={`${btnBase} w-full sm:w-auto max-w-xs border border-on-photo text-on-photo bg-scrim/25 backdrop-blur-sm hover:bg-scrim/40`}
            >
              Mağazayı ziyaret et
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

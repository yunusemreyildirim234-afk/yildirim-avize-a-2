import Image from "next/image";
import Link from "next/link";

// Vitrin hero: sabit salon fotoğrafı (public/hero/salon-avize.webp, 1920×1072) + metin.
// Masaüstü (md+): fotoğraf sağ %60'ı kaplar, sol kenarı zemin rengine (canvas) erir; metin solda, DÜZ zemin üzerindedir (sütun fotoğrafın başladığı yerde biter),
// böylece yazı-zemin kontrastı tema jetonlarının kendi kontrastıdır. Mobil: fotoğraf üstte 4/3, metin altında düz zeminde.
// Arama ve kategori bağlantıları Navbar'dadır (masaüstü NavSearch + kategori satırı, mobil arama simgesi + kategori şeridi).

const btnBase =
  "inline-flex items-center justify-center min-h-11 px-6 rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink";

export default function Hero() {
  return (
    <section className="relative bg-canvas text-ink overflow-hidden md:h-[62vh] md:min-h-[420px] md:max-h-[640px]">
      <div className="relative aspect-[4/3] w-full md:absolute md:inset-y-0 md:right-0 md:left-[40%] md:aspect-auto">
        <Image
          src="/hero/salon-avize.webp"
          alt="Altın rengi avizenin aydınlattığı modern bir oturma odası"
          fill
          priority
          sizes="(min-width: 768px) 60vw, 100vw"
          className="object-cover object-[40%_0%] md:object-[50%_0%]"
        />
        <div aria-hidden="true" className="hidden md:block absolute inset-y-0 left-0 w-[40%] bg-gradient-to-r from-canvas via-canvas/60 to-transparent" />
      </div>

      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-8 md:py-0 md:h-full md:flex md:items-center">
        <div className="text-center md:text-left md:w-[36%]">
          <h1 className="font-serif text-ink">
            <span className="block text-4xl sm:text-5xl md:text-3xl lg:text-5xl xl:text-6xl font-black uppercase tracking-[0.12em]">Yıldırım Avize</span>
            <span className="sr-only"> — </span>
            <span className="mt-3 block text-lg sm:text-xl md:text-base lg:text-xl font-bold tracking-normal text-ink-muted">Kristal, klasik ve modern avizeler</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-ink-muted max-w-xl mx-auto md:mx-0">
            Beyoğlu Şişhane&apos;den Türkiye&apos;ye kristal, modern ve klasik avizeler.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3 sm:justify-center md:justify-start">
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

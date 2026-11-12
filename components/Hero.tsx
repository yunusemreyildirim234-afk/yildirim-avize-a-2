import Image from "next/image";
import SearchBar from "@/components/SearchBar";

// Kurumsal amblem: /logo-hero-3.png (şeffaf arka planlı, orijinal renkler; CSS filtresi yok). Dekoratif: marka adı h1'de yazılıdır.
function LogoEmblem() {
  return (
    <Image src="/logo-hero-3.png" alt="" width={640} height={298} priority className="mx-auto h-auto w-44 sm:w-56" />
  );
}

export default function Hero() {
  return (
    <section className="bg-white px-4 pt-6 pb-8 sm:pt-8 sm:pb-12">
      <div className="max-w-3xl mx-auto text-center">
        <LogoEmblem />
        <h1 className="mt-1 text-4xl sm:text-6xl font-serif font-black tracking-tight text-zinc-950">Yıldırım Avize</h1>
        <Image src="/logo-uc-gen.png" alt="" width={128} height={65} className="mx-auto mt-1 h-auto w-12 sm:w-14" />

        <div className="mt-5 sm:mt-6 max-w-2xl mx-auto">
          <SearchBar />
        </div>

        <p className="mt-5 text-lg sm:text-xl font-serif font-bold tracking-[0.15em] text-[#B5002A]">Avize &amp; Aydınlatma</p>
        <p className="mt-2 text-xs sm:text-sm text-zinc-500">Beyoğlu Şişhane&apos;den Türkiye&apos;ye kristal, modern ve klasik avizeler</p>
      </div>
    </section>
  );
}

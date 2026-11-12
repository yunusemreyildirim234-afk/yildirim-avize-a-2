import Image from "next/image";
import SearchBar from "@/components/SearchBar";

// Kurumsal amblem: /anaekran.jpg içindeki piramit amblemi kırpılır; açık temada levha zemini beyaza karışır (multiply), koyu temada renkler ters çevrilip siyah zemin ekrana karışır (screen)
function LogoEmblem() {
  return (
    <div className="relative mx-auto w-44 sm:w-56 aspect-[430/280] overflow-hidden mix-blend-multiply dark:mix-blend-screen dark:invert dark:hue-rotate-180" role="img" aria-label="Yıldırım Avize amblemi">
      <Image
        src="/anaekran.jpg"
        alt=""
        aria-hidden="true"
        width={1280}
        height={720}
        priority
        className="absolute max-w-none brightness-[1.12] contrast-[1.05]"
        style={{ width: "297.7%", left: "-127.9%", top: "-32.1%" }}
      />
    </div>
  );
}

export default function Hero() {
  return (
    <section className="bg-white px-4 pt-6 pb-8 sm:pt-8 sm:pb-12">
      <div className="max-w-3xl mx-auto text-center">
        <LogoEmblem />
        <h1 className="mt-1 text-4xl sm:text-6xl font-serif font-black tracking-tight text-zinc-950">Yıldırım Avize</h1>

        <div className="mt-5 sm:mt-6 max-w-2xl mx-auto">
          <SearchBar />
        </div>

        <p className="mt-5 text-lg sm:text-xl font-serif font-bold tracking-[0.15em] text-[#B5002A]">Avize &amp; Aydınlatma</p>
        <p className="mt-2 text-xs sm:text-sm text-zinc-500">Beyoğlu Şişhane&apos;den Türkiye&apos;ye kristal, modern ve klasik avizeler</p>
      </div>
    </section>
  );
}

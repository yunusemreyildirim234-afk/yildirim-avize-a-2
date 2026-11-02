import Image from "next/image";
import SearchBar from "@/components/SearchBar";

// Kurumsal amblem: /anaekran.jpg içindeki piramit amblemi kırpılır; levha zemini beyaza karışır
function LogoEmblem() {
  return (
    <div className="relative mx-auto w-64 sm:w-80 aspect-[430/280] overflow-hidden mix-blend-multiply dark:mix-blend-normal dark:bg-[#fff] dark:rounded-3xl" aria-hidden="true">
      <Image
        src="/anaekran.jpg"
        alt=""
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
    <section className="bg-white px-4 pt-10 pb-16 sm:pt-16 sm:pb-24">
      <div className="max-w-3xl mx-auto text-center">
        <LogoEmblem />
        <h1 className="mt-2 text-5xl sm:text-7xl font-serif font-black tracking-tight text-zinc-950">Yıldırım Avize</h1>

        <div className="mt-8 sm:mt-10 max-w-2xl mx-auto">
          <SearchBar />
        </div>

        <p className="mt-8 text-xl sm:text-2xl font-serif font-bold tracking-[0.35em] text-[#B5002A]">LIGHTING</p>
        <p className="mt-3 text-xs sm:text-sm text-zinc-500">Beyoğlu Şişhane&apos;den Türkiye&apos;ye kristal, modern ve klasik avizeler</p>
      </div>
    </section>
  );
}

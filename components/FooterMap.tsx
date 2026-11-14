"use client";

import { useState } from "react";

/** Harita, sayfa açılışında Google'dan yüklenmez: tıklanınca gömülü harita (iframe) açılır. Yol tarifi bağlantısı Footer'da ayrıdır. */
export default function FooterMap({ src, title }: { src: string; title: string }) {
  const [shown, setShown] = useState(false);
  if (shown) {
    return <iframe title={title} src={src} className="w-full h-48 rounded-2xl border border-zinc-800 grayscale-[40%] hover:grayscale-0 transition" />;
  }
  return (
    <div className="w-full h-48 rounded-2xl border border-zinc-800 bg-zinc-900 flex flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-xs text-neutral-400">Beyoğlu Şişhane mağaza konumu</p>
      <button
        type="button"
        onClick={() => setShown(true)}
        className="text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg px-4 min-h-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
      >
        Haritayı göster
      </button>
    </div>
  );
}

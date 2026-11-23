"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { parseVideoUrl } from "@/lib/video-url";

/**
 * Ürün videosu. Video yoksa (boş/geçersiz adres) HİÇBİR ŞEY çizilmez.
 * YouTube/Vimeo: "tıklayınca yükle" (facade). İlk yüklemede üçüncü taraf isteği YOK; kutuda yalnız ürünün kendi kapak fotoğrafı (poster) ve oynat düğmesi vardır,
 * iframe (YouTube: youtube-nocookie.com) düğmeye basılınca oluşur. MP4: <video controls preload="none">.
 */
export default function ProductVideo({ url, title, poster, className = "", framed = false }: { url?: string | null; title: string; poster?: string | null; className?: string; framed?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const parsed = parseVideoUrl(url);
  const video = parsed.ok ? parsed.video : null;
  if (!video) return null;

  const box = (
    <div className={`aspect-video w-full overflow-hidden rounded-lg bg-black ${className}`} data-testid="urun-video">
      {video.provider === "mp4" ? (
        <video src={video.src} controls preload="none" playsInline aria-label={`${title} tanıtım videosu`} className="h-full w-full" />
      ) : playing ? (
        <iframe
          src={`${video.embedUrl}${video.provider === "youtube" ? "?autoplay=1&rel=0" : "?autoplay=1"}`}
          title={`${title} tanıtım videosu`}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`${title} ürün videosunu oynat`}
          className="group relative flex h-full w-full items-center justify-center bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-500"
        >
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-90" />
          )}
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-lg">
            <Play aria-hidden="true" className="ml-0.5 h-6 w-6" fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  );
  // framed: ürün galerisinin altındaki koyu şerit; video yoksa (yukarıda null döner) şerit de çizilmez
  return framed ? <div className="keep-theme bg-neutral-900 border-t border-neutral-800 p-3">{box}</div> : box;
}

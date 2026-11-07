"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DRAG_THRESHOLD = 8; // px: bunu aşan hareket sürükleme sayılır, bırakınca bağlantı tıklaması bastırılır
const SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

/**
 * Ürün kartı görseli. Tek görselde eski çıktı AYNEN (ek öğe yok). 2+ görselde: yatay scroll-snap, masaüstünde ok, altta noktalar.
 * Ek görseller kart ile etkileşime (pointerenter / touchstart / odak) girilene kadar istenmez.
 * Kart bir bağlantıdır: ok tıklaması ve sürükleme sayfa geçişini tetiklemez.
 */
export default function CardImages({
  images,
  alt,
  priority = false,
  children,
}: {
  images: string[];
  alt: string;
  priority?: boolean;
  /** Rozetler (indirim, adet, tükendi): görselin üstünde, eskisi gibi */
  children?: React.ReactNode;
}) {
  const multi = images.length > 1;
  const [armed, setArmed] = useState(false);
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; dragged: boolean } | null>(null);

  const arm = () => setArmed(true);

  const go = (e: React.MouseEvent, dir: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();
    const el = trackRef.current;
    if (!el) return;
    setArmed(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = Math.min(images.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth) + dir));
    el.scrollTo({ left: next * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  };

  const first = (
    <Image
      src={images[0]}
      alt={alt}
      fill
      priority={priority}
      sizes={SIZES}
      className="object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );

  if (!multi) {
    return (
      <div className="relative aspect-square bg-zinc-100 overflow-hidden rounded-t-2xl">
        {images.length === 1 ? first : (
          <div className="absolute inset-0 flex items-center justify-center text-3xl" aria-hidden="true">
            💡
          </div>
        )}
        {children}
      </div>
    );
  }

  const arrow =
    "hidden md:flex absolute top-1/2 -translate-y-1/2 z-[5] w-8 h-8 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600 transition-opacity";

  return (
    <div
      className="relative aspect-square bg-zinc-100 overflow-hidden rounded-t-2xl"
      onPointerEnter={arm}
      onTouchStart={arm}
      onFocusCapture={arm}
    >
      <div
        ref={trackRef}
        data-testid="card-track"
        className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, dragged: false };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (s && Math.abs(e.clientX - s.x) > DRAG_THRESHOLD) s.dragged = true;
        }}
        onClickCapture={(e) => {
          if (start.current?.dragged) {
            e.preventDefault();
            e.stopPropagation();
          }
          start.current = null;
        }}
      >
        <div className="relative shrink-0 w-full h-full snap-center">{first}</div>
        {images.slice(1).map((src, i) => (
          <div key={src} className="relative shrink-0 w-full h-full snap-center">
            {armed && (
              <Image
                src={src}
                alt={`${alt} ${i + 2}. fotoğraf`}
                fill
                loading="lazy"
                decoding="async"
                sizes={SIZES}
                className="object-cover"
              />
            )}
          </div>
        ))}
      </div>

      {index > 0 && (
        <button type="button" aria-label="Önceki fotoğraf" onClick={(e) => go(e, -1)} className={`${arrow} left-2`}>
          <ChevronLeft aria-hidden="true" className="w-5 h-5" />
        </button>
      )}
      {index < images.length - 1 && (
        <button type="button" aria-label="Sonraki fotoğraf" onClick={(e) => go(e, 1)} className={`${arrow} right-2`}>
          <ChevronRight aria-hidden="true" className="w-5 h-5" />
        </button>
      )}
      <div data-testid="card-dots" aria-hidden="true" className="absolute bottom-1.5 inset-x-0 z-[5] flex justify-center gap-1 pointer-events-none">
        {images.map((_, i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white shadow" : "bg-white/50"}`} />
        ))}
      </div>
      {children}
    </div>
  );
}

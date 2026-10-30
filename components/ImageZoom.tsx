"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, X, ZoomIn } from "lucide-react";

const LENS = 170; // büyüteç çapı (px)
const LENS_ZOOM = 2.6;

/** Ana görsel: masaüstünde fare üstünde büyüteç, tıklayınca onZoom. */
export function HoverMagnifier({ src, alt, onZoom }: { src: string; alt: string; onZoom: () => void }) {
  const boxRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
  };

  return (
    <button
      ref={boxRef}
      type="button"
      onClick={onZoom}
      onPointerMove={onMove}
      onPointerLeave={() => setPos(null)}
      aria-label="Görseli büyüt"
      className="absolute inset-0 w-full h-full cursor-zoom-in"
    >
      <img src={src} alt={alt} className="w-full h-full object-cover" />
      <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 bg-zinc-900/80 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full">
        <ZoomIn aria-hidden="true" className="w-3.5 h-3.5" /> Büyüt
      </span>
      {pos && (
        <span
          aria-hidden="true"
          className="hidden md:block absolute pointer-events-none rounded-full overflow-hidden border-2 border-white/80 shadow-xl bg-zinc-900"
          style={{ width: LENS, height: LENS, left: pos.x - LENS / 2, top: pos.y - LENS / 2 }}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute max-w-none object-cover"
            style={{
              width: pos.w * LENS_ZOOM,
              height: pos.h * LENS_ZOOM,
              left: LENS / 2 - pos.x * LENS_ZOOM,
              top: LENS / 2 - pos.y * LENS_ZOOM,
            }}
          />
        </span>
      )}
    </button>
  );
}

const MIN = 1;
const MAX = 6;
const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));

/** Tam ekran görsel: +/- butonları, sıfırlama, tekerlek, çift tıklama ve sürükleyerek kaydırma. */
export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const setZoom = (next: number) => {
    const s = clamp(next);
    setScale(s);
    if (s === 1) setOffset({ x: 0, y: 0 });
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };
  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") setZoom(scale + 0.5);
      else if (e.key === "-") setZoom(scale - 0.5);
      else if (e.key === "0") reset();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  });

  // Tekerlek ile zoom (passive olmayan dinleyici: sayfa kaymasını engeller)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => {
        const next = clamp(s * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
        if (next === 1) setOffset({ x: 0, y: 0 });
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const btn =
    "w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 disabled:opacity-40 disabled:hover:bg-white/15 text-white flex items-center justify-center transition-colors";

  return (
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[100] bg-zinc-950/95 select-none">
      <div
        ref={stageRef}
        onClick={() => scale === 1 && onClose()}
        className="absolute inset-0 flex items-center justify-center p-3 sm:p-8 overflow-hidden"
        style={{ touchAction: "none" }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={() => (scale > 1 ? reset() : setZoom(2.5))}
          onPointerDown={(e) => {
            if (scale === 1) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
            setDragging(true);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setOffset({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y });
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={`max-w-full max-h-full object-contain rounded-lg ${scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: dragging ? "none" : "transform 120ms ease-out",
          }}
        />
      </div>

      <button type="button" onClick={onClose} aria-label="Kapat" className={`${btn} absolute top-3 right-3 sm:top-5 sm:right-5`}>
        <X aria-hidden="true" className="w-6 h-6" />
      </button>

      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex items-center gap-2 rounded-full bg-zinc-900/70 p-1.5">
        <button type="button" onClick={() => setZoom(scale - 0.5)} disabled={scale <= MIN} aria-label="Uzaklaştır" className={btn}>
          <Minus aria-hidden="true" className="w-5 h-5" />
        </button>
        <span className="min-w-12 text-center text-xs font-semibold text-white tabular-nums">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => setZoom(scale + 0.5)} disabled={scale >= MAX} aria-label="Yakınlaştır" className={btn}>
          <Plus aria-hidden="true" className="w-5 h-5" />
        </button>
        <button type="button" onClick={reset} disabled={scale === 1 && offset.x === 0 && offset.y === 0} aria-label="Varsayılan boyuta dön" className={btn}>
          <RotateCcw aria-hidden="true" className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap } from "@/components/useFocusTrap";
import { parseVideoUrl, videoAspect, videoPlayerSrc } from "@/lib/video-url";

/** Ürün videosu penceresi. İçerik yalnız açılınca oluşur; kapanınca iframe/video tamamen kaldırılır (ses durur). */
export default function ProductVideoModal({ open, url, title, onClose }: { open: boolean; url?: string | null; title: string; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(open, boxRef, { onEscape: onClose, initialFocus: closeRef });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const parsed = parseVideoUrl(url);
  const video = parsed.ok ? parsed.video : null;
  if (!open || !video) return null;

  const aspect = videoAspect(video, url);
  const src = videoPlayerSrc(video);
  const label = `${title} tanıtım videosu`;
  const frame =
    aspect === "vertical"
      ? { aspectRatio: "9 / 16", width: "min(90vw, calc(85vh * 9 / 16))" }
      : { aspectRatio: "16 / 9", width: "min(90vw, calc(85vh * 16 / 9))" };

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-2 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} role="dialog" aria-modal="true" aria-label={label} data-testid="urun-video-modal" className="flex items-center justify-center">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Videoyu kapat"
          className="fixed right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 sm:right-5 sm:top-5"
        >
          <X aria-hidden="true" className="h-6 w-6" />
        </button>
        {video.provider === "mp4" ? (
          <video src={video.src} controls autoPlay playsInline aria-label={label} className="max-h-[85vh] max-w-[90vw] rounded-lg bg-black object-contain" />
        ) : (
          <div style={frame} className="overflow-hidden rounded-lg bg-black">
            <iframe
              src={src ?? undefined}
              title={label}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full border-0"
            />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

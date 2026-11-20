"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { buildProductShare, isShareAbortError, type ProductShareInput } from "@/lib/product-share";

function copyWithTextareaFallback(text: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.left = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function ProductShareButton({ product }: { product: ProductShareInput }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const getShare = () =>
    buildProductShare({
      ...product,
      url: typeof window !== "undefined" ? window.location.href : null,
    });

  const markCopied = () => {
    setCopied(true);
    toast.success("Bağlantı kopyalandı");
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      setCopied(false);
      copyTimerRef.current = null;
    }, 2000);
  };

  const handleTriggerClick = async () => {
    if (open) {
      setOpen(false);
      return;
    }

    const share = getShare();
    const payload = { title: share.title, text: share.text, url: share.url };

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        if (typeof navigator.canShare === "function" && !navigator.canShare(payload)) {
          setOpen(true);
          return;
        }
        await navigator.share(payload);
        return;
      } catch (err) {
        if (isShareAbortError(err)) {
          return;
        }
        setOpen(true);
        return;
      }
    }

    setOpen(true);
  };

  const handleCopy = async () => {
    const { url } = getShare();
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(url);
        markCopied();
        return;
      }
      throw new Error("Clipboard API unavailable");
    } catch {
      if (copyWithTextareaFallback(url)) {
        markCopied();
        return;
      }
      if (typeof window !== "undefined" && typeof window.prompt === "function") {
        window.prompt("Bağlantıyı kopyalayın:", url);
      }
    }
  };

  const share = open ? getShare() : null;

  return (
    <div ref={containerRef} className="relative shrink-0 w-11 h-11">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleTriggerClick}
        aria-label="Ürünü paylaş"
        title="Paylaş"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="urun-paylas-butonu"
        className="w-11 h-11 rounded-full bg-raised/90 hover:bg-raised border border-line-strong shadow-md flex items-center justify-center text-ink-muted hover:text-ink transition-transform active:scale-90"
      >
        <Share2 aria-hidden="true" className="w-4 h-4" />
      </button>

      {open && share && (
        <div
          role="dialog"
          aria-label="Paylaşım seçenekleri"
          data-testid="urun-paylas-menusu"
          className="absolute right-0 top-full mt-2 z-30 w-56 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-line bg-raised p-1.5 shadow-xl space-y-1"
        >
          <button
            type="button"
            onClick={handleCopy}
            data-testid="paylas-kopyala"
            className={`w-full min-h-10 flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${
              copied
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "text-ink hover:bg-surface"
            }`}
          >
            {copied ? (
              <Check aria-hidden="true" className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <Copy aria-hidden="true" className="w-4 h-4 shrink-0 text-ink-muted" />
            )}
            <span aria-live="polite">{copied ? "Kopyalandı" : "Bağlantıyı Kopyala"}</span>
          </button>

          <div className="border-t border-line my-1" />

          <a
            href={share.links.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="paylas-whatsapp"
            onClick={() => setOpen(false)}
            className="w-full min-h-10 flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-ink hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
          >
            <MessageCircle aria-hidden="true" className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>WhatsApp</span>
          </a>

          <a
            href={share.links.facebook}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="paylas-facebook"
            onClick={() => setOpen(false)}
            className="w-full min-h-10 flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-ink hover:bg-blue-50 hover:text-blue-800 transition-colors"
          >
            <span aria-hidden="true" className="w-4 h-4 shrink-0 inline-flex items-center justify-center font-bold text-blue-600">
              f
            </span>
            <span>Facebook</span>
          </a>

          <a
            href={share.links.x}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="paylas-x"
            onClick={() => setOpen(false)}
            className="w-full min-h-10 flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-ink hover:bg-surface hover:text-ink transition-colors"
          >
            <span aria-hidden="true" className="w-4 h-4 shrink-0 inline-flex items-center justify-center font-bold text-ink">
              𝕏
            </span>
            <span>X</span>
          </a>

          <a
            href={share.links.email}
            data-testid="paylas-eposta"
            onClick={() => setOpen(false)}
            className="w-full min-h-10 flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-ink hover:bg-amber-50 hover:text-bronze-ink transition-colors"
          >
            <Mail aria-hidden="true" className="w-4 h-4 shrink-0 text-bronze-ink" />
            <span>E-posta</span>
          </a>
        </div>
      )}
    </div>
  );
}

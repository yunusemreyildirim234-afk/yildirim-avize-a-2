"use client";

import { useRef } from "react";
import { downloadImage, UPLOAD_QUOTA_NOTE, type PickerItem } from "@/lib/client-upload";

// Çoklu fotoğraf seçici: önizleme, sıra değiştir, sil; ilk görsel kapaktır. Dosya işleme (yükleme/önizleme) üst bileşendedir.
export default function ImagePicker({
  items,
  max,
  onAddFiles,
  onChange,
  disabled = false,
  label,
  productTitle,
  onReplaceFile,
}: {
  items: PickerItem[];
  max: number;
  onAddFiles: (files: File[]) => void;
  onChange: (items: PickerItem[]) => void;
  disabled?: boolean;
  label: string;
  /** İndirilen dosya adı için ürün adı (verilmezse İndir düğmesi gösterilmez). */
  productTitle?: string;
  /** Verilirse her görselde "Değiştir" çıkar: seçilen dosya aynı sıradaki görselin yerine konur. */
  onReplaceFile?: (index: number, file: File) => void | Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceIndex = useRef(0);
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const makeCover = (i: number) => {
    if (i <= 0 || i >= items.length) return;
    onChange([items[i], ...items.filter((_, j) => j !== i)]);
  };
  const full = items.length >= max;
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((it, i) => (
            <li key={it.key} className="w-24 space-y-1">
              <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-neutral-300 bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.src} alt={`${label} ${i + 1}`} width={96} height={96} className="w-full h-full object-cover" />
                {i === 0 && <span className="absolute left-1 top-1 rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">Kapak</span>}
              </div>
              {i > 0 && (
                <button type="button" onClick={() => makeCover(i)} disabled={disabled} className="w-full min-h-8 rounded border border-amber-600 bg-white text-[11px] font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-30">
                  Kapak yap
                </button>
              )}
              {(productTitle !== undefined || onReplaceFile) && (
                <div className="flex gap-1">
                  {productTitle !== undefined && (
                    <button type="button" onClick={() => void downloadImage(it.src, productTitle, i)} className="flex-1 min-h-8 rounded border border-neutral-300 bg-white text-[11px] font-semibold text-neutral-700 hover:border-amber-600">
                      İndir
                    </button>
                  )}
                  {onReplaceFile && (
                    <button
                      type="button"
                      onClick={() => {
                        replaceIndex.current = i;
                        replaceInput.current?.click();
                      }}
                      disabled={disabled}
                      className="flex-1 min-h-8 rounded border border-neutral-300 bg-white text-[11px] font-semibold text-neutral-700 hover:border-amber-600 disabled:opacity-30"
                    >
                      Değiştir
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={disabled || i === 0} aria-label={`${i + 1}. fotoğrafı öne al`} className="min-w-8 min-h-8 rounded border border-neutral-300 bg-white disabled:opacity-30">
                  ▲
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={disabled || i === items.length - 1} aria-label={`${i + 1}. fotoğrafı sona al`} className="min-w-8 min-h-8 rounded border border-neutral-300 bg-white disabled:opacity-30">
                  ▼
                </button>
                <button type="button" onClick={() => onChange(items.filter((x) => x.key !== it.key))} disabled={disabled} aria-label="Fotoğrafı sil" className="min-w-8 min-h-8 rounded border border-red-300 bg-white font-bold text-red-700 disabled:opacity-30">
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onAddFiles(files.slice(0, Math.max(0, max - items.length)));
        }}
      />
      <input
        ref={replaceInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && onReplaceFile) void onReplaceFile(replaceIndex.current, file);
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled || full}
        className="min-h-10 rounded-lg border border-neutral-300 bg-white px-3 font-semibold text-neutral-800 hover:border-amber-600 disabled:opacity-50"
      >
        {full ? `En fazla ${max} fotoğraf` : `+ Fotoğraf Ekle (${items.length}/${max})`}
      </button>
      <p className="text-[11px] text-neutral-500">{UPLOAD_QUOTA_NOTE}</p>
    </div>
  );
}

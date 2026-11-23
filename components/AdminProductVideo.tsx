"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import ProductVideo from "@/components/ProductVideo";
import { parseVideoUrl } from "@/lib/video-url";

const field = "p-2 rounded-lg border border-neutral-300 bg-white text-base sm:text-xs focus:outline-none focus:border-amber-600";
const LABELS = { youtube: "YouTube videosu", vimeo: "Vimeo videosu", mp4: "MP4 dosyası" } as const;

async function call(method: "GET" | "PATCH", productId: string, body?: Record<string, unknown>) {
  const res = await fetch(method === "GET" ? `/api/admin/product?productId=${encodeURIComponent(productId)}&fields=video` : "/api/admin/product", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify({ productId, ...body }) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "İşlem başarısız.");
  return data as { videoUrl?: string | null };
}

// Ürün videosu (tek adres). "Tümünü kaydet"ten bağımsız: Kaydet/Sil kendi isteğiyle hemen uygulanır (lib/video-url.ts sunucuda da doğrular).
export default function AdminProductVideo({ productId, title, poster }: { productId: string; title: string; poster?: string | null }) {
  const [saved, setSaved] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null); // hangi ürün için okundu (kimlik değişince bölüm yeniden "yükleniyor" olur)
  const loaded = loadedFor === productId;
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    call("GET", productId)
      .then((d) => {
        if (!alive) return;
        setSaved(d.videoUrl ?? null);
        setText(d.videoUrl ?? "");
        setLoadedFor(productId);
      })
      .catch((e: Error) => alive && setMsg({ ok: false, text: e.message }));
    return () => {
      alive = false;
    };
  }, [productId]);

  const parsed = parseVideoUrl(text);
  const invalid = !parsed.ok && text.trim() !== "";
  const changed = text.trim() !== (saved ?? "");

  const write = async (value: string | null) => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await call("PATCH", productId, { videoUrl: value });
      setSaved(d.videoUrl ?? null);
      setText(d.videoUrl ?? "");
      setMsg({ ok: true, text: d.videoUrl ? "Video kaydedildi." : "Video silindi." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "İşlem başarısız." });
    } finally {
      setBusy(false);
      setAskDelete(false);
    }
  };

  return (
    <section className="space-y-2 border-t border-neutral-200 pt-4" data-testid="video-bolumu">
      <h4 className="font-semibold text-neutral-700">Video</h4>
      <p className="text-[11px] text-neutral-500">Yalnız yayın hakkı sizde olan videoları ekleyin. YouTube, Vimeo veya https ile başlayan .mp4 bağlantısı eklenebilir; ürün sayfasında tıklayınca yüklenir.</p>
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Video adresi"
          aria-invalid={invalid}
          type="url"
          inputMode="url"
          maxLength={500}
          disabled={!loaded || busy}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className={`${field} flex-1 min-w-0 basis-64`}
        />
        <button
          type="button"
          disabled={!loaded || busy || invalid || !changed || !parsed.ok || !parsed.video}
          onClick={() => parsed.ok && parsed.video && write(parsed.video.url)}
          className="min-h-10 bg-white border border-neutral-300 hover:border-amber-600 font-semibold px-3 rounded-lg disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-amber-600"
        >
          Kaydet
        </button>
        {saved && (
          <button type="button" disabled={busy} onClick={() => setAskDelete(true)} className="min-h-10 px-3 font-semibold text-red-600 hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-amber-600">
            Sil
          </button>
        )}
      </div>
      {invalid && !parsed.ok && (
        <p role="alert" className="text-red-700 font-semibold">
          {parsed.error}
        </p>
      )}
      {parsed.ok && parsed.video && (
        <div className="space-y-1">
          <p className="text-neutral-600">
            {LABELS[parsed.video.provider]}
            {changed && " · kaydedilmedi"}
          </p>
          <ProductVideo url={parsed.video.url} title={title} poster={poster} className="max-w-xs" />
        </div>
      )}
      <p role="status" aria-live="polite" className={msg ? (msg.ok ? "text-emerald-800 font-semibold" : "text-red-700 font-semibold") : "sr-only"}>
        {msg?.text}
      </p>
      <ConfirmDialog open={askDelete} title="Video silinsin mi?" confirmLabel="Evet, sil" danger confirmDisabled={busy} onConfirm={() => write(null)} onCancel={() => setAskDelete(false)}>
        Bu üründeki video kaldırılır; ürün sayfasında video görünmez. İstersen adresi sonra yeniden ekleyebilirsin.
      </ConfirmDialog>
    </section>
  );
}

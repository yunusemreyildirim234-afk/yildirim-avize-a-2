"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Copy, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { DESCRIPTION_OVERWRITE_WARNING, MAX_DESCRIPTION } from "@/lib/product-description";

interface Loaded {
  description: string;
  trendyolDescription: string | null;
  textOverwrite: boolean;
}

const btn = "inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-amber-600";

/** Ürün açıklaması: düzenle, kopyala, Trendyol'un son gönderdiği metni göster / geri yükle. Veri açılınca okunur (liste yükünü büyütmez). */
export default function AdminDescriptionEditor({ productId, title }: { productId: string; title: string }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [showTrendyol, setShowTrendyol] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/product?productId=${encodeURIComponent(productId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Açıklama okunamadı.");
        return data as { description: string | null; trendyolDescription: string | null; textOverwrite: boolean };
      })
      .then((d) => {
        if (!alive) return;
        setLoaded({ description: d.description ?? "", trendyolDescription: d.trendyolDescription, textOverwrite: d.textOverwrite });
        setValue(d.description ?? "");
      })
      .catch((e) => {
        if (alive) setError((e as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [productId]);

  const save = async () => {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/admin/product", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, description: value }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Açıklama kaydedilemedi.");
      const saved: string = data.description ?? "";
      setLoaded((l) => (l ? { ...l, description: saved } : l));
      setValue(saved);
      setStatus(saved ? "Açıklama kaydedildi." : "Açıklama boşaltıldı; ürün sayfasında açıklama görünmez.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    setError("");
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Açıklama panoya kopyalandı.");
    } catch {
      setError("Kopyalanamadı; metni seçip elle kopyalayın.");
    }
  };

  const id = `aciklama-${productId}`;
  const dirty = loaded !== null && value !== loaded.description;
  const tooLong = value.length > MAX_DESCRIPTION;

  return (
    <div data-testid="aciklama-duzenleyici" className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-4 sm:px-6">
      <label htmlFor={id} className="block text-xs font-bold text-neutral-800">
        Ürün açıklaması <span className="font-normal text-neutral-500">({title})</span>
      </label>
      {loaded?.textOverwrite && (
        <p role="alert" data-testid="aciklama-ezme-uyarisi" className="mt-2 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900">
          <AlertTriangle aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-red-700" />
          <span>
            {DESCRIPTION_OVERWRITE_WARNING} Trendyol Ürünleri bölümünde &ldquo;Başlık ve açıklama&rdquo; ayarı şu an &ldquo;Ezerek&rdquo;; açıklamanızın kalması için &ldquo;Dokunma&rdquo; ya da &ldquo;Koruyarak&rdquo; seçin.
          </span>
        </p>
      )}
      {loaded === null && !error && <p className="mt-2 text-xs text-neutral-500">Açıklama yükleniyor…</p>}
      {loaded !== null && (
        <>
          <textarea
            id={id}
            rows={8}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setStatus("");
            }}
            aria-describedby={`${id}-bilgi`}
            aria-invalid={tooLong}
            placeholder="Avizenin malzemesi, ölçüsü, kullanım alanı, ampul bilgisi…"
            className="mt-2 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-900 focus:border-amber-600 focus:outline-none"
          />
          <p id={`${id}-bilgi`} className={`mt-1 text-[11px] ${tooLong ? "font-semibold text-red-700" : "text-neutral-500"}`}>
            {value.length.toLocaleString("tr-TR")} / {MAX_DESCRIPTION.toLocaleString("tr-TR")} karakter. Boş bırakıp kaydederseniz ürün sayfasında açıklama görünmez.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={saving || !dirty || tooLong} onClick={save} className="inline-flex min-h-10 items-center rounded-lg bg-neutral-900 px-4 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-amber-600">
              {saving ? "Kaydediliyor…" : "Açıklamayı kaydet"}
            </button>
            <button type="button" disabled={!value} onClick={copy} className={btn}>
              <Copy aria-hidden="true" className="h-3.5 w-3.5" /> Kopyala
            </button>
            {loaded.trendyolDescription ? (
              <button type="button" aria-expanded={showTrendyol} onClick={() => setShowTrendyol((s) => !s)} className={btn}>
                {showTrendyol ? "Trendyol metnini gizle" : "Trendyol metnini göster"}
              </button>
            ) : (
              <span className="text-[11px] text-neutral-500">Bu ürün için kayıtlı Trendyol metni yok.</span>
            )}
          </div>
          {showTrendyol && loaded.trendyolDescription && (
            <div data-testid="trendyol-metni" className="mt-3 rounded-xl border border-neutral-200 bg-white p-3">
              <p className="text-[11px] font-bold text-neutral-700">Trendyol&apos;un son eşitlemede gönderdiği metin</p>
              <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-neutral-700">{loaded.trendyolDescription}</p>
              <button
                type="button"
                disabled={value === loaded.trendyolDescription}
                onClick={() => {
                  setValue(loaded.trendyolDescription ?? "");
                  setStatus("Trendyol metni alana yazıldı; kalıcı olması için kaydedin.");
                }}
                className={`${btn} mt-2`}
              >
                <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" /> Trendyol metnini geri yükle
              </button>
            </div>
          )}
        </>
      )}
      {status && <p role="status" className="mt-2 text-xs font-semibold text-emerald-800">{status}</p>}
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}

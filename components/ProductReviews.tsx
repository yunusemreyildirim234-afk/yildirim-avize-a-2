"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import type { ReviewEligibility } from "@/lib/reviews";
import SmartFilterChips from "@/components/SmartFilterChips";
import { compressImageToWebP, MAX_RAW_BYTES, MAX_UPLOAD_BYTES } from "@/lib/client-image";

export interface ReviewItem {
  id: string;
  author: string;
  rating: number;
  comment: string;
  imageUrl: string | null;
  verified: boolean;
  createdAt: string;
}

function Stars({ value, className = "w-4 h-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex" role="img" aria-label={`5 üzerinden ${value} yıldız`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={`${className} ${n <= Math.round(value) ? "fill-amber-500 text-amber-500" : "text-ink-subtle"}`}
        />
      ))}
    </span>
  );
}

export default function ProductReviews({
  productId,
  reviews,
  eligibility,
}: {
  productId: string;
  reviews: ReviewItem[];
  eligibility: ReviewEligibility | "guest";
}) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Yıldız filtresi: boş seçim = Tümü; birden fazla puan birlikte seçilebilir
  const [starFilter, setStarFilter] = useState<string[]>([]);
  const visibleReviews = starFilter.length === 0 ? reviews : reviews.filter((r) => starFilter.includes(String(Math.round(r.rating))));
  const starOptions = [5, 4, 3, 2, 1].map((n) => ({ key: String(n), label: `★ ${n}`, count: reviews.filter((r) => Math.round(r.rating) === n).length }));

  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const body = new FormData();
      body.set("productId", productId);
      body.set("rating", String(rating));
      body.set("comment", comment);
      if (photo) body.set("image", photo);
      const res = await fetch("/api/reviews", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yorum gönderilemedi.");
      setComment("");
      setPhoto(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-labelledby="yorumlar" className="bg-raised rounded-3xl border border-line p-6 sm:p-8 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <h2 id="yorumlar" className="text-lg font-serif font-bold text-ink">
          Müşteri Yorumları
        </h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <Stars value={average} />
            <strong className="text-ink">{average.toFixed(1)}</strong>
            <span>({reviews.length} yorum)</span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-ink-muted">Bu ürün için henüz yorum yapılmamış.{typeof eligibility === "object" && eligibility.state === "can" ? " İlk yorumu siz yazın." : ""}</p>
      ) : (
        <>
          <SmartFilterChips label="Yıldıza göre yorum filtresi" options={starOptions} selected={starFilter} total={reviews.length} onChange={setStarFilter} />
          {visibleReviews.length === 0 ? (
            <p role="status" className="rounded-2xl bg-surface border border-line p-5 text-center text-sm text-ink-muted">
              Bu puanda henüz değerlendirme bulunmuyor.
            </p>
          ) : (
        <ul className="space-y-5">
          {visibleReviews.map((r) => (
            <li key={r.id} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars value={r.rating} />
                <strong className="text-sm text-ink">{r.author}</strong>
                {r.verified && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Doğrulanmış Alıcı
                  </span>
                )}
                <time dateTime={r.createdAt} className="text-xs text-ink-subtle">
                  {new Date(r.createdAt).toLocaleDateString("tr-TR")}
                </time>
              </div>
              <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-line">{r.comment}</p>
              {r.imageUrl && (
                <a href={r.imageUrl} target="_blank" rel="noopener noreferrer" className="inline-block pt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.imageUrl} alt={`${r.author} müşterimizin gönderdiği fotoğraf`} width={112} height={112} loading="lazy" decoding="async" className="h-28 w-28 rounded-xl object-cover border border-line" />
                </a>
              )}
            </li>
          ))}
        </ul>
          )}
        </>
      )}

      <div className="border-t border-line pt-5">
        {typeof eligibility === "object" && eligibility.state === "reviewed" ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900 space-y-1.5">
            <p className="font-semibold">
              {eligibility.review.status === "APPROVED"
                ? "Bu ürün için değerlendirmeniz bulunmaktadır."
                : "Değerlendirmeniz alındı; incelendikten sonra yayınlanacaktır."}
            </p>
            {(
              <>
                <Stars value={eligibility.review.rating} />
                <p className="text-ink-muted whitespace-pre-line">{eligibility.review.comment}</p>
                {eligibility.review.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={eligibility.review.imageUrl} alt="Gönderdiğiniz fotoğraf" width={96} height={96} loading="lazy" decoding="async" className="h-24 w-24 rounded-xl object-cover border border-line" />
                )}
              </>
            )}
          </div>
        ) : typeof eligibility === "object" && eligibility.state === "no-purchase" ? (
          <p className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-950">
            Bu ürüne yalnızca ürünü satın almış olan müşterilerimiz yorum yapabilir.
          </p>
        ) : typeof eligibility === "object" ? (
          <form onSubmit={submit} className="space-y-3">
            <h3 className="text-sm font-bold text-ink">Yorum Yaz</h3>
            <div role="radiogroup" aria-label="Puan" className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} yıldız`}
                  onClick={() => setRating(n)}
                >
                  <Star
                    aria-hidden="true"
                    className={`w-6 h-6 ${n <= rating ? "fill-amber-500 text-amber-500" : "text-ink-subtle"}`}
                  />
                </button>
              ))}
            </div>
            <textarea
              required
              minLength={10}
              maxLength={1000}
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              aria-label="Yorumunuz"
              placeholder="Ürünle ilgili deneyiminizi paylaşın..."
              className="w-full p-3 rounded-xl border border-line-strong text-sm focus:border-bronze-ink focus-visible:outline-2 focus-visible:outline-bronze-ink"
            />
            <div className="text-xs">
              <label className="font-semibold text-ink-muted block mb-1">Avize fotoğrafı (isteğe bağlı — JPG, PNG, WEBP, en çok 20 MB, otomatik küçültülür)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const input = e.target;
                  const f = input.files?.[0] ?? null;
                  setPhoto(null);
                  setError("");
                  if (!f) return;
                  if (f.size > MAX_RAW_BYTES) {
                    setError("Fotoğraf en fazla 20 MB olabilir.");
                    input.value = "";
                    return;
                  }
                  setOptimizing(true);
                  const out = await compressImageToWebP(f, { maxWidth: 1600, quality: 0.82 });
                  setOptimizing(false);
                  if (out.size > MAX_UPLOAD_BYTES) {
                    setError("Fotoğraf küçültülemedi veya hâlâ 4,5 MB'dan büyük. Lütfen farklı bir fotoğraf seçin.");
                    input.value = "";
                    return;
                  }
                  setPhoto(out);
                }}
                className="block w-full text-xs text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ink hover:file:bg-line"
              />
              {optimizing && <p className="mt-1 text-[11px] text-bronze-ink">Görsel optimize ediliyor...</p>}
            </div>
            <p className="text-[11px] text-ink-muted">Yorumunuz ve fotoğrafınız yönetici onayından sonra yayınlanır.</p>
            {error && (
              <p role="alert" className="text-xs text-red-600">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || optimizing}
              className="bg-ink hover:bg-bronze-ink text-canvas text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {optimizing ? "Görsel optimize ediliyor..." : loading ? "Gönderiliyor..." : "Yorumu Gönder"}
            </button>
          </form>
        ) : (
          <p className="text-sm text-ink-muted">
            Yorum yazmak için{" "}
            <Link href="/giris" className="text-bronze-ink font-semibold underline underline-offset-2">
              giriş yapın
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import type { ReviewEligibility } from "@/lib/reviews";

export interface ReviewItem {
  id: string;
  author: string;
  rating: number;
  comment: string;
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
          className={`${className} ${n <= Math.round(value) ? "fill-amber-500 text-amber-500" : "text-neutral-300"}`}
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yorum gönderilemedi.");
      setComment("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-labelledby="yorumlar" className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
        <h2 id="yorumlar" className="text-lg font-serif font-bold text-neutral-900">
          Müşteri Yorumları
        </h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <Stars value={average} />
            <strong className="text-neutral-900">{average.toFixed(1)}</strong>
            <span>({reviews.length} yorum)</span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-neutral-500">Bu ürün için henüz yorum yapılmamış. İlk yorumu siz yazın.</p>
      ) : (
        <ul className="space-y-5">
          {reviews.map((r) => (
            <li key={r.id} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars value={r.rating} />
                <strong className="text-sm text-neutral-900">{r.author}</strong>
                {r.verified && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Doğrulanmış Alıcı
                  </span>
                )}
                <time dateTime={r.createdAt} className="text-xs text-neutral-400">
                  {new Date(r.createdAt).toLocaleDateString("tr-TR")}
                </time>
              </div>
              <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{r.comment}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-neutral-100 pt-5">
        {typeof eligibility === "object" && eligibility.state === "reviewed" ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900 space-y-1.5">
            <p className="font-semibold">Bu ürün için değerlendirmeniz bulunmaktadır.</p>
            {(
              <>
                <Stars value={eligibility.review.rating} />
                <p className="text-neutral-700 whitespace-pre-line">{eligibility.review.comment}</p>
              </>
            )}
          </div>
        ) : typeof eligibility === "object" && eligibility.state === "no-purchase" ? (
          <p className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-950">
            Bu ürüne yalnızca ürünü satın almış olan müşterilerimiz yorum yapabilir.
          </p>
        ) : typeof eligibility === "object" ? (
          <form onSubmit={submit} className="space-y-3">
            <h3 className="text-sm font-bold text-neutral-900">Yorum Yaz</h3>
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
                    className={`w-6 h-6 ${n <= rating ? "fill-amber-500 text-amber-500" : "text-neutral-300"}`}
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
              className="w-full p-3 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-amber-600"
            />
            {error && (
              <p role="alert" className="text-xs text-red-600">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="bg-neutral-900 hover:bg-amber-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? "Gönderiliyor..." : "Yorumu Gönder"}
            </button>
          </form>
        ) : (
          <p className="text-sm text-neutral-600">
            Yorum yazmak için{" "}
            <Link href="/giris" className="text-amber-700 font-semibold underline underline-offset-2">
              giriş yapın
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}

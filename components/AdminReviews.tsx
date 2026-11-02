"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export interface AdminReview {
  id: string;
  author: string;
  email: string;
  productTitle: string;
  rating: number;
  comment: string;
  imageUrl: string | null;
  status: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING: { text: "Onay Bekliyor", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  APPROVED: { text: "Yayında", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  REJECTED: { text: "Reddedildi", cls: "bg-red-50 text-red-700 border-red-200" },
};

export default function AdminReviews({ reviews }: { reviews: AdminReview[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const call = async (id: string, method: "PATCH" | "DELETE", status?: string) => {
    if (method === "DELETE" && !confirm("Bu yorum kalıcı olarak silinsin mi?")) return;
    setBusy(id);
    try {
      const res = await fetch("/api/admin/reviews", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: id, status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "İşlem başarısız.");
      toast.success(method === "DELETE" ? "Yorum silindi" : status === "APPROVED" ? "Yorum onaylandı" : "Yorum reddedildi");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (reviews.length === 0) return <p className="p-6 text-sm text-neutral-500">Henüz müşteri yorumu yok.</p>;

  return (
    <ul className="divide-y divide-neutral-100">
      {reviews.map((r) => {
        const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.PENDING;
        return (
          <li key={r.id} className="p-5 flex flex-col sm:flex-row gap-4">
            {r.imageUrl && (
              <a href={r.imageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.imageUrl} alt="Müşteri fotoğrafı" loading="lazy" className="h-28 w-28 rounded-xl object-cover border border-neutral-200" />
              </a>
            )}
            <div className="min-w-0 flex-1 space-y-1.5 text-xs">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex" role="img" aria-label={`${r.rating} yıldız`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} aria-hidden="true" className={`w-3.5 h-3.5 ${n <= r.rating ? "fill-amber-500 text-amber-500" : "text-neutral-300"}`} />
                  ))}
                </span>
                <strong className="text-neutral-900">{r.author}</strong>
                <span className="text-neutral-400">{r.email}</span>
                <span className={`border px-2 py-0.5 rounded-full font-semibold ${st.cls}`}>{st.text}</span>
                <time dateTime={r.createdAt} className="text-neutral-400">
                  {new Date(r.createdAt).toLocaleString("tr-TR")}
                </time>
              </div>
              <p className="text-neutral-500">
                Ürün: <span className="font-semibold text-neutral-800">{r.productTitle}</span>
              </p>
              <p className="text-sm text-neutral-700 whitespace-pre-line leading-relaxed">{r.comment}</p>
            </div>
            <div className="flex sm:flex-col items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={busy === r.id || r.status === "APPROVED"}
                onClick={() => call(r.id, "PATCH", "APPROVED")}
                aria-label="Onayla"
                title="Onayla"
                className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center disabled:opacity-40 transition-colors"
              >
                <Check className="w-5 h-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={busy === r.id || r.status === "REJECTED"}
                onClick={() => call(r.id, "PATCH", "REJECTED")}
                aria-label="Reddet"
                title="Reddet"
                className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center disabled:opacity-40 transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => call(r.id, "DELETE")}
                aria-label="Sil"
                title="Kalıcı sil"
                className="w-10 h-10 rounded-xl border border-neutral-300 text-neutral-500 hover:text-red-600 hover:border-red-300 flex items-center justify-center disabled:opacity-40 transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

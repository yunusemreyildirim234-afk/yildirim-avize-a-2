import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { prisma } from "@/lib/db";
import { initials, REVIEW_STATUS } from "@/lib/reviews";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Müşterilerimizden Gelenler",
  description: "Yıldırım Avize müşterilerinin evlerinden ve mekanlarından gönderdiği avize fotoğrafları ve gerçek alışveriş yorumları.",
  alternates: { canonical: "/musterilerimizden-gelenler" },
};

export default async function CustomerGalleryPage() {
  const reviews = await prisma.review
    .findMany({
      where: { status: REVIEW_STATUS.APPROVED, imageUrl: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: {
        id: true,
        rating: true,
        comment: true,
        imageUrl: true,
        createdAt: true,
        user: { select: { name: true } },
        product: { select: { id: true, title: true } },
      },
    })
    .catch(() => []);

  return (
    <main className="min-h-screen bg-neutral-50 pb-20">
      <section className="bg-neutral-950 text-white py-14 px-4 text-center border-b border-neutral-800">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold">Gerçek Müşteri Fotoğrafları</span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-neutral-100">Müşterilerimizden Gelenler</h1>
          <p className="text-sm text-neutral-400 font-light">
            Avizelerimizi satın alan müşterilerimizin kendi mekanlarından paylaştığı fotoğraflar ve yorumlar.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        {reviews.length === 0 ? (
          <div className="bg-white rounded-3xl border border-neutral-200 p-10 text-center text-sm text-neutral-600">
            Henüz yayınlanmış müşteri fotoğrafı bulunmuyor. Satın aldığınız ürünün sayfasından fotoğraf ve yorum ekleyebilirsiniz.
          </div>
        ) : (
          <ul className="columns-1 sm:columns-2 lg:columns-3 gap-5 [&>li]:mb-5">
            {reviews.map((r) => (
              <li key={r.id} className="break-inside-avoid bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
                <a href={r.imageUrl!} target="_blank" rel="noopener noreferrer" className="block bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.imageUrl!} alt={`${r.product.title} - müşteri fotoğrafı`} loading="lazy" className="w-full h-auto object-cover" />
                </a>
                <div className="p-4 space-y-2">
                  <span className="inline-flex" role="img" aria-label={`5 üzerinden ${r.rating} yıldız`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} aria-hidden="true" className={`w-4 h-4 ${n <= r.rating ? "fill-amber-500 text-amber-500" : "text-neutral-300"}`} />
                    ))}
                  </span>
                  <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{r.comment}</p>
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-neutral-100 text-xs">
                    <span className="font-semibold text-neutral-900">{initials(r.user.name)}</span>
                    <Link href={`/urun/${r.product.id}`} className="text-amber-700 hover:underline text-right line-clamp-1">
                      {r.product.title}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

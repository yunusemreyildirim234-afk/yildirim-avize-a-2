import Link from "next/link";
import { X } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import Pagination from "@/components/Pagination";
import PageSizeLinks from "@/components/PageSizeLinks";
import ListingFilters, { ListingSort } from "@/components/ListingControls";
import { hasFilters, type ListingState } from "@/lib/listing-core";
import type { Listing } from "@/lib/listing";
import type { ProductWithVariations } from "@/lib/products";
import { rangeOf, totalPages, type Adet } from "@/lib/pagination";


/**
 * /arama ve /kategori/[slug] için ORTAK liste görünümü: araç çubuğu (ürün sayısı, sayfa başına, sırala), seçili filtre çipleri, sol filtre paneli (mobilde çekmece),
 * ürün ızgarası (mevcut ProductCard) ve sayfalama. Durum adreste (?siralama=&kategori=&renk=&ebat=&fiyat_min=&fiyat_max=&adet=&sayfa=); sunucuda çizilir, JS olmadan da çalışır.
 */
export default function ProductListing({
  path,
  fixed = {},
  listing,
  products,
  page,
  adet,
  size,
  note,
  empty,
}: {
  path: string;
  /** Süzgeçle değişmeyen taban parametreler (arama: q) */
  fixed?: Record<string, string>;
  listing: Listing;
  products: ProductWithVariations[];
  page: number;
  adet: Adet;
  size: number;
  note?: React.ReactNode;
  /** Taban küme boşken (süzgeç yok) gösterilecek içerik */
  empty: React.ReactNode;
}) {
  const { state, facets, params, total } = listing;
  const filtered = hasFilters(state);
  const base = { ...fixed, ...params }; // sayfalama/adet bağlantıları bunu taşır
  const adetParam = adet === "24" ? undefined : adet;
  const range = rangeOf(page, total, size);
  const pages = totalPages(total, size);
  const href = (patch: Partial<Record<string, string | undefined>>) => {
    const q = new URLSearchParams();
    const merged: Record<string, string | undefined> = { ...fixed, ...params, ...(adetParam ? { adet: adetParam } : {}), ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
  const clearHref = href({ kategori: undefined, renk: undefined, ebat: undefined, fiyat_min: undefined, fiyat_max: undefined });

  // Seçili filtre çipleri: her biri kendi kaldırma bağlantısı
  const chips: { label: string; to: string }[] = [
    ...state.kategoriler.map((slug) => ({ label: facets.categories.find((c) => c.slug === slug)?.title ?? slug, to: href({ kategori: state.kategoriler.filter((s) => s !== slug).join(",") || undefined }) })),
    ...state.renkler.map((key) => ({ label: facets.colors.find((c) => c.key === key)?.name ?? key, to: href({ renk: state.renkler.filter((k) => k !== key).join(",") || undefined }) })),
    ...state.ebatlar.map((key) => ({ label: `Ebat: ${facets.sizes.find((z) => z.key === key)?.name ?? key}`, to: href({ ebat: state.ebatlar.filter((k) => k !== key).join(",") || undefined }) })),
    ...(state.fiyatMin !== undefined || state.fiyatMax !== undefined ? [{ label: priceLabel(state), to: href({ fiyat_min: undefined, fiyat_max: undefined }) }] : []),
  ];

  const nothingAtAll = total === 0 && !filtered;
  if (nothingAtAll) return <>{empty}</>;

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-zinc-200 pb-4 mb-4 text-xs text-zinc-500">
      <div className="flex items-center gap-4">
        <p role="status" aria-live="polite" data-testid="urun-sayisi">
          <strong className="text-zinc-900 tabular-nums">{total}</strong> ürün{range ? ` · ${range.from}-${range.to} gösteriliyor` : ""}
        </p>
        {note}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <PageSizeLinks path={path} current={adet} page={page} size={size} params={base} />
        <ListingSort key={JSON.stringify(base)} path={path} fixed={fixed} params={params} adet={adetParam} current={state.siralama} />
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[17rem_minmax(0,1fr)]">
      <ListingFilters
        key={JSON.stringify(params) + adet}
        path={path}
        fixed={fixed}
        params={params}
        adet={adetParam}
        current={state.siralama}
        facets={facets}
        total={total}
        clearHref={clearHref}
        filtered={filtered}
      />
      <div className="min-w-0 pt-4 lg:pt-0">
        {toolbar}
        {chips.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Seçili filtreler" role="group">
            {chips.map((c) => (
              <Link key={c.label} href={c.to} rel="nofollow" aria-label={`${c.label} filtresini kaldır`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 text-xs font-medium text-amber-950 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600">
                {c.label}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ))}
            <Link href={clearHref} rel="nofollow" className="inline-flex min-h-9 items-center px-2 text-xs font-semibold text-zinc-900 underline underline-offset-2">
              Filtreleri temizle
            </Link>
          </div>
        )}

        {products.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-10 text-center space-y-3" data-testid="liste-bos">
            <h2 className="font-serif font-bold text-zinc-900 text-base">Filtrelere uyan ürün bulunamadı</h2>
            <Link href={clearHref} rel="nofollow" className="inline-block bg-zinc-900 hover:bg-amber-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors">
              Filtreleri temizle
            </Link>
          </div>
        ) : (
          <>
            <Pagination path={path} page={page} pages={pages} params={base} label="Sayfalama (üst)" className="mb-8" />
            <h2 className="sr-only">Ürünler</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {products.map((product, i) => (
                <ProductCard key={product.id} product={product} priority={i < 3} />
              ))}
            </div>
            <Pagination path={path} page={page} pages={pages} params={base} label="Sayfalama (alt)" />
          </>
        )}
      </div>
    </div>
  );
}

const tl = (n: number) => `${n.toLocaleString("tr-TR")} ₺`;
function priceLabel(s: ListingState): string {
  if (s.fiyatMin !== undefined && s.fiyatMax !== undefined) return `${tl(s.fiyatMin)} – ${tl(s.fiyatMax)}`;
  return s.fiyatMin !== undefined ? `En az ${tl(s.fiyatMin)}` : `En çok ${tl(s.fiyatMax!)}`;
}

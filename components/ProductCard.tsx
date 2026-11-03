import Image from "next/image";
import Link from "next/link";
import type { ProductWithVariations } from "@/lib/products";
import { bulkTiersOf } from "@/lib/bulk-pricing";
import { CartStepper, FavoriteButton } from "@/components/ProductQuickActions";

export default function ProductCard({
  product,
  dark = false,
  priority = false,
}: {
  product: ProductWithVariations;
  dark?: boolean;
  /** Sayfa üstündeki (LCP) kartlar için görseli öncelikli yükler */
  priority?: boolean;
}) {
  const totalStock = product.variations.reduce((sum, v) => sum + v.stock, 0);
  const discount =
    product.listPrice && product.listPrice > product.basePrice
      ? Math.round((1 - product.basePrice / product.listPrice) * 100)
      : 0;

  const bulk = bulkTiersOf(product);

  // İstemci bileşenlerine yalnızca gereken alanlar geçirilir
  const quick = {
    id: product.id,
    title: product.title,
    category: product.category,
    basePrice: product.basePrice,
    imageUrl: product.imageUrl,
    bulk,
    variations: product.variations.map((v) => ({
      id: v.id,
      variationValue: v.variationValue,
      extraPrice: v.extraPrice,
      stock: v.stock,
    })),
  };

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(24,24,27,0.35)] focus-within:shadow-[0_8px_24px_-12px_rgba(24,24,27,0.35)] ${
        dark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-zinc-200/80 text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.05)]"
      }`}
    >
      <Link href={`/urun/${product.id}`} className="flex flex-col flex-1">
        <div className="relative aspect-square bg-zinc-100 overflow-hidden rounded-t-2xl">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.title}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-3xl" aria-hidden="true">
              💡
            </div>
          )}
          {discount > 0 && (
            <span className="absolute top-3 left-3 bg-red-600 text-white text-[11px] font-bold px-2 py-1 rounded-md">
              %{discount} İndirim
            </span>
          )}
          {bulk.length > 0 && (
            <span className={`absolute left-3 bg-amber-100 text-amber-950 text-[11px] font-semibold px-2 py-1 rounded-md ${discount > 0 ? "top-11" : "top-3"}`}>
              {bulk[0].minQty}+ Adet İndirimi
            </span>
          )}
          {totalStock === 0 && (
            <span className="absolute bottom-3 left-3 bg-zinc-900/85 text-white text-[11px] font-medium px-2 py-1 rounded-md">
              Tükendi
            </span>
          )}
        </div>

        <div className="p-4 pb-3 sm:p-5 sm:pb-3 flex-1 flex flex-col justify-between gap-3">
          <div>
            <span className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${dark ? "text-amber-400" : "text-amber-800"}`}>
              {product.category}
            </span>
            <h3 className="font-serif text-[15px] font-semibold leading-snug tracking-tight line-clamp-2 mt-1 min-h-[2.6em]">{product.title}</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tabular-nums">{product.basePrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
            {discount > 0 && product.listPrice && (
              <span className="text-xs line-through text-zinc-500">{product.listPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
            )}
          </div>
        </div>
      </Link>

      {/* Link dışında: hızlı aksiyonlar kartın bağlantısını tetiklemez */}
      <FavoriteButton product={quick} className="absolute top-3 right-3 z-10" />
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <CartStepper product={quick} />
      </div>
    </div>
  );
}

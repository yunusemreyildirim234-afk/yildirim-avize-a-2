import Image from "next/image";
import Link from "next/link";
import type { ProductWithVariations } from "@/lib/products";

export default function ProductCard({
  product,
  dark = false,
}: {
  product: ProductWithVariations;
  dark?: boolean;
}) {
  const totalStock = product.variations.reduce((sum, v) => sum + v.stock, 0);
  const discount =
    product.listPrice && product.listPrice > product.basePrice
      ? Math.round((1 - product.basePrice / product.listPrice) * 100)
      : 0;

  return (
    <Link
      href={`/urun/${product.id}`}
      className={`group flex flex-col rounded-2xl border overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        dark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900 shadow-sm"
      }`}
    >
      <div className="relative aspect-square bg-zinc-100 overflow-hidden">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
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
        {totalStock === 0 && (
          <span className="absolute top-3 right-3 bg-zinc-900/85 text-white text-[11px] font-medium px-2 py-1 rounded-md">
            Tükendi
          </span>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <span className={`text-[11px] font-medium ${dark ? "text-amber-400" : "text-amber-700"}`}>
            {product.category}
          </span>
          <h3 className="text-sm font-semibold leading-snug line-clamp-2 mt-0.5">{product.title}</h3>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold">{product.basePrice.toLocaleString("tr-TR")} ₺</span>
          {discount > 0 && product.listPrice && (
            <span className={`text-xs line-through ${dark ? "text-zinc-400" : "text-zinc-400"}`}>
              {product.listPrice.toLocaleString("tr-TR")} ₺
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

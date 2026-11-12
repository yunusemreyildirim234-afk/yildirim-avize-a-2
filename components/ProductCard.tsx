import CardImages from "@/components/CardImages";
import Link from "next/link";
import type { ProductWithVariations } from "@/lib/products";
import { bulkTiersOf } from "@/lib/bulk-pricing";
import PriceLadder, { priceTone } from "@/components/PriceLadder";
import { getLadderContext } from "@/lib/showcase";
import { priceLadder } from "@/lib/price-ladder";
import { coverImageOf, galleryOf } from "@/lib/variation-input";
import { CartStepper, FavoriteButton } from "@/components/ProductQuickActions";
import { isPurchasablePrice } from "@/lib/purchasable";
import { displayTitle } from "@/lib/title-display";
import { lowStockLabel } from "@/lib/low-stock";
import { getLowStockSetting } from "@/lib/low-stock-setting";

export default async function ProductCard({
  product,
  dark = false,
  priority = false,
}: {
  product: ProductWithVariations;
  dark?: boolean;
  /** Sayfa üstündeki (LCP) kartlar için görseli öncelikli yükler */
  priority?: boolean;
}) {
  const shownTitle = displayTitle(product.title); // yalnızca gösterim; alt metin, bağlantı ve veri tam başlığı korur
  const ladder = priceLadder(product, await getLadderContext());
  const totalStock = product.variations.reduce((sum, v) => sum + v.stock, 0);
  const lowStock = lowStockLabel(totalStock, await getLowStockSetting()); // ayar kapalıysa null
  const discount =
    product.listPrice && product.listPrice > product.basePrice
      ? Math.round((1 - product.basePrice / product.listPrice) * 100)
      : 0;

  const priceOnRequest = !isPurchasablePrice(product.basePrice); // fiyatı 0/altı: ürün sayfasıyla aynı dil
  const bulk = bulkTiersOf(product);
  // Kapak: varsayılan (ilk stoklu) rengin fotoğrafı varsa o, yoksa ürün kapağı
  const cover = coverImageOf(product);
  // Kart galerisi: ürün sayfasının açılış galerisiyle aynı sıra (genel fotoğraflar, yoksa ilk rengin), en çok 4; eski önbellekte images olmayabilir
  const gallery = galleryOf({ ...product, images: product.images ?? [] }, null, false).slice(0, 4);

  // İstemci bileşenlerine yalnızca gereken alanlar geçirilir
  const quick = {
    id: product.id,
    title: product.title,
    category: product.category,
    basePrice: product.basePrice,
    listPrice: product.listPrice,
    imageUrl: cover,
    bulk,
    variations: product.variations.map((v) => ({
      id: v.id,
      variationValue: v.variationValue,
      extraPrice: v.extraPrice,
      stock: v.stock,
      images: (v.images ?? []).slice(0, 1), // eski önbellek kayıtlarında alan olmayabilir
    })),
  };

  return (
    <div
      data-soldout={totalStock === 0 ? "true" : undefined}
      className={`group relative flex flex-col rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(24,24,27,0.35)] focus-within:shadow-[0_8px_24px_-12px_rgba(24,24,27,0.35)] ${
        dark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-zinc-200/80 text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.05)]"
      }`}
    >
      <Link href={`/urun/${product.id}`} className={`flex flex-col flex-1 ${totalStock === 0 ? "[&_img]:opacity-60" : ""}`}>
        <CardImages images={gallery} alt={product.title} priority={priority}>
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
          {lowStock && (
            <span data-testid="son-adet-rozet" className="absolute bottom-3 left-3 bg-amber-100 text-amber-950 text-[11px] font-semibold px-2 py-1 rounded-md">
              {lowStock}
            </span>
          )}
          {totalStock === 0 && (
            <span className="absolute bottom-3 left-3 bg-zinc-900/85 text-white text-[11px] font-medium px-2 py-1 rounded-md">
              Tükendi
            </span>
          )}
        </CardImages>

        <div className="p-2.5 pb-2 sm:p-5 sm:pb-3 flex-1 flex flex-col justify-between gap-1.5 sm:gap-3">
          <div>
            {product.category.trim() && (
              <span className={`block text-[11px] font-semibold uppercase tracking-[0.08em] ${dark ? "text-amber-400" : "text-amber-800"}`}>
                {product.category}
              </span>
            )}
            <h3 className="font-serif text-sm sm:text-[15px] font-semibold leading-snug tracking-tight line-clamp-2 mt-0.5 sm:mt-1 sm:min-h-[2.6em]">{shownTitle.title}</h3>
            {shownTitle.assembled && (
              <span className={`mt-1 inline-block sm:hidden text-[10px] font-semibold rounded px-1.5 py-0.5 border ${dark ? "border-zinc-600 text-zinc-300" : "border-zinc-300 text-zinc-700"}`}>Montajlı</span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            {priceOnRequest ? (
              <span data-testid="fiyat-icin-sorun" className="text-sm sm:text-base font-semibold">Fiyat için sorun</span>
            ) : (
              <span className={`text-base sm:text-lg font-bold tabular-nums ${discount > 0 ? priceTone(dark).sale : ""}`}>{product.basePrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
            )}
            {!priceOnRequest && discount > 0 && product.listPrice && (
              <span className="text-xs line-through text-zinc-500">{product.listPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
            )}
            {/* sm ve üstü: Montajlı rozeti fiyatın sağında (kart bir satır kısalır); mobilde başlığın altında kalır */}
            {shownTitle.assembled && (
              <span className={`hidden sm:inline-block ml-auto self-center shrink-0 text-[10px] font-semibold rounded px-1.5 py-0.5 border ${dark ? "border-zinc-600 text-zinc-300" : "border-zinc-300 text-zinc-700"}`}>Montajlı</span>
            )}
          </div>
          {!priceOnRequest && <PriceLadder steps={ladder} size="card" dark={dark} itemsTotal={product.basePrice} />}
        </div>
      </Link>

      {/* Link dışında: hızlı aksiyonlar kartın bağlantısını tetiklemez */}
      <FavoriteButton product={quick} className="absolute top-3 right-3 z-10" />
      <div className="px-2.5 pb-2.5 sm:px-5 sm:pb-5">
        <CartStepper product={quick} />
      </div>
    </div>
  );
}

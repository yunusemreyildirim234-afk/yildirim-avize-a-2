import CardImages from "@/components/CardImages";
import Link from "next/link";
import type { ProductWithVariations } from "@/lib/products";
import { bulkTiersOf } from "@/lib/bulk-pricing";
import PriceLadder, { priceTone } from "@/components/PriceLadder";
import { getLadderContext } from "@/lib/showcase";
import { priceLadder } from "@/lib/price-ladder";
import { coverImageOf, galleryOf } from "@/lib/variation-input";
import { CartStepper, FavoriteButton } from "@/components/ProductQuickActions";
import { PRICE_CONTACT_TEXT, hasPrice } from "@/lib/has-price";
import { displayTitle } from "@/lib/title-display";
import { lowStockLabel } from "@/lib/low-stock";
import { getLowStockSetting } from "@/lib/low-stock-setting";
import { productPath } from "@/lib/product-url";

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

  const priceOnRequest = !hasPrice(product.basePrice); // fiyatı 0/altı: ürün sayfasıyla aynı dil
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
      className={`group relative flex flex-col rounded-xl ${dark ? "bg-zinc-900 text-zinc-100" : "bg-surface text-ink"}`}
    >
      <Link href={productPath(product)} className={`flex flex-col flex-1 ${totalStock === 0 ? "[&_img]:opacity-60" : ""}`}>
        <CardImages images={gallery} alt={product.title} priority={priority}>
          {/* En fazla 1 rozet, sol üst: Tükendi > %N İndirim */}
          {totalStock === 0 ? (
            <span className="absolute top-3 left-3 bg-ink/85 text-canvas text-[11px] font-medium px-2 py-1 rounded-md">
              Tükendi
            </span>
          ) : discount > 0 ? (
            <span className="absolute top-3 left-3 bg-sale text-white text-[11px] font-bold px-2 py-1 rounded-md">
              %{discount} İndirim
            </span>
          ) : null}
        </CardImages>

        <div className="p-2.5 pb-2 sm:p-5 sm:pb-3 flex-1 flex flex-col justify-between gap-1.5 sm:gap-3">
          <div>
            {(product.category.trim() || shownTitle.assembled) && (
              <span className="flex items-baseline gap-1.5 text-[11px] leading-tight">
                {product.category.trim() && (
                  <span className={`font-semibold uppercase tracking-[0.08em] ${dark ? "text-amber-400" : "text-bronze-ink"}`}>{product.category}</span>
                )}
                {shownTitle.assembled && <span className={dark ? "text-zinc-400" : "text-ink-muted"}>Montajlı</span>}
              </span>
            )}
            <h3 className="font-serif text-sm sm:text-[15px] font-semibold leading-snug tracking-tight line-clamp-2 mt-0.5 sm:mt-1 sm:min-h-[2.6em]">{shownTitle.title}</h3>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              {priceOnRequest ? (
                <span data-testid="fiyat-icin-sorun" className="text-sm sm:text-base font-semibold">{PRICE_CONTACT_TEXT}</span>
              ) : (
                <span className={`text-base sm:text-lg font-bold tabular-nums ${discount > 0 ? priceTone(dark).sale : ""}`}>{product.basePrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
              )}
              {!priceOnRequest && discount > 0 && product.listPrice && (
                <span className={`text-xs line-through ${dark ? "text-zinc-400" : "text-ink-subtle"}`}>{product.listPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
              )}
            </div>
            {!priceOnRequest && <PriceLadder steps={ladder} size="card" dark={dark} itemsTotal={product.basePrice} />}
            {/* Adet indirimi ve son adet: rozet değil, küçük bilgi satırı */}
            {(bulk.length > 0 || lowStock) && (
              <p className={`mt-1 flex flex-wrap gap-x-2 text-[11px] leading-tight ${dark ? "text-zinc-400" : "text-ink-muted"}`}>
                {bulk.length > 0 && <span>{bulk[0].minQty}+ adet indirimi</span>}
                {lowStock && <span data-testid="son-adet-rozet" className="font-semibold">{lowStock}</span>}
              </p>
            )}
          </div>
        </div>
      </Link>

      {/* Link dışında: hızlı aksiyonlar kartın bağlantısını tetiklemez */}
      <FavoriteButton product={quick} className="absolute top-3 right-3 z-10" />
      <div className="px-2.5 pb-2.5 sm:px-5 sm:pb-5">
        {priceOnRequest ? (
          <button type="button" disabled className="w-full rounded-xl bg-surface text-ink-subtle text-xs font-semibold py-2">
            Sepete eklenemez
          </button>
        ) : (
          <CartStepper product={quick} />
        )}
      </div>
    </div>
  );
}

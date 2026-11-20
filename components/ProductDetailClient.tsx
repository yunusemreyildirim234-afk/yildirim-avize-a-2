"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toastHref } from "@/lib/toast-link";
import { coverImageOf, galleryOf } from "@/lib/variation-input";
import { FavoriteButton } from "@/components/ProductQuickActions";
import { HoverMagnifier, ImageLightbox } from "@/components/ImageZoom";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { FREE_SHIPPING_THRESHOLD, PICKUP_DISCOUNT, SHIPPING_TYPES } from "@/lib/pricing";
import { priceCart, ruleNotes } from "@/lib/cart-pricing";
import { withShowcaseNote } from "@/lib/coupon-code";
import PriceLadder, { priceTone } from "@/components/PriceLadder";
import { priceLadder, type LadderContext } from "@/lib/price-ladder";
import { SITE_URL, WHATSAPP_NUMBER } from "@/lib/site";
import { isPurchasablePrice } from "@/lib/purchasable";
import { activeTier, bulkLabel, bulkTiersOf, unitPriceFor } from "@/lib/bulk-pricing";
import { lowStockLabel, type LowStockSetting } from "@/lib/low-stock";
import { bulbNoteFor, isAccessoryCategory } from "@/lib/bulb-note";
import { smallImage } from "@/lib/img";
import { displayTitle } from "@/lib/title-display";
import { pickDefaultOption } from "@/lib/default-variation";
import InstallmentLink from "@/components/InstallmentLink";
import ProductShareButton from "@/components/ProductShareButton";

interface Variation {
  id: string;
  variationType: string;
  variationValue: string;
  extraPrice: number;
  stock: number;
  images?: string[];
}

interface Product {
  id: string;
  title: string;
  description: string | null;
  category: string;
  basePrice: number;
  imageUrl?: string | null;
  modelCode?: string | null;
  images?: string[];
  listPrice?: number | null;
  bulkTiers?: unknown;
  couponAllowed?: boolean;
  pickupDiscountPct?: number | null;
  transferDiscountPct?: number | null;
  variations: Variation[];
}

const galleryArrow =
  "hidden md:flex absolute top-1/2 -translate-y-1/2 z-10 w-11 h-11 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-lg opacity-0 group-hover/gal:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-bronze-ink transition-opacity";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function ProductDetailClient({ product, ladderCtx, categoryHref, lowStock }: { product: Product; ladderCtx: LadderContext; categoryHref?: string; lowStock?: LowStockSetting }) {
  const router = useRouter();
  const maxTotalDiscountPct = ladderCtx.maxTotalDiscountPct;
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useWishlist();

  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(
    pickDefaultOption(product.variations) // kart fiyatıyla aynı kural (lib/default-variation.ts); URL'de seçenek parametresi yok
  );
  // Sayfa genel fotoğraflarla açılır; kullanıcı bir renk seçince o rengin fotoğrafları (varsa) öne gelir (lib/variation-input.ts galleryOf)
  const [colorChosen, setColorChosen] = useState(false);
  const gallery = galleryOf(product, selectedVariation, colorChosen);
  const [activeImage, setActiveImage] = useState(0);
  const mainImage = gallery[activeImage] ?? null;
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const longDesc = (product.description?.length ?? 0) > 280 || (product.description?.split("\n").length ?? 0) > 5;
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const programmatic = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Küçük resim / ok / klavye / "Büyüt" gezinmesi: fotoğrafa kaydır (bu sırada kaydırma olayı durum üretmesin)
  const showImage = (i: number) => {
    const n = Math.min(gallery.length - 1, Math.max(0, i));
    setActiveImage(n);
    const el = trackRef.current;
    if (!el) return;
    if (programmatic.current) clearTimeout(programmatic.current);
    programmatic.current = setTimeout(() => (programmatic.current = null), 600);
    el.scrollTo({ left: n * el.clientWidth, behavior: reducedMotion() ? "auto" : "smooth" });
  };
  // Seçili küçük resim, KENDİ şeridinde görünür alana kayar. İlk yüklemede çalışmaz ve sayfayı kaydırmaz
  // (scrollIntoView tüm üst kaydırma alanlarını, sayfa dahil, oynatıyordu: açılışta ~180 px kayma).
  const thumbsMounted = useRef(false);
  useEffect(() => {
    if (!thumbsMounted.current) {
      thumbsMounted.current = true;
      return;
    }
    const box = thumbsRef.current;
    const t = box?.children[activeImage] as HTMLElement | undefined;
    if (!box || !t) return;
    const b = box.getBoundingClientRect();
    const r = t.getBoundingClientRect();
    const behavior = reducedMotion() ? "auto" : "smooth";
    if (r.left < b.left || r.right > b.right) box.scrollTo({ left: box.scrollLeft + (r.left < b.left ? r.left - b.left : r.right - b.right), behavior });
    if (r.top < b.top || r.bottom > b.bottom) box.scrollTo({ top: box.scrollTop + (r.top < b.top ? r.top - b.top : r.bottom - b.bottom), behavior });
  }, [activeImage]);

  const shownTitle = displayTitle(product.title); // yalnızca başlık gösterimi; sepet, mesajlar ve alt metin tam başlığı kullanır
  const bulbNote =bulbNoteFor(product.title, product.category);
  const currentPrice = product.basePrice + (selectedVariation?.extraPrice || 0);
  const listShown = product.listPrice && product.listPrice > product.basePrice ? product.listPrice + (selectedVariation?.extraPrice || 0) : null;
  const bulk = bulkTiersOf(product);
  const unitNow = unitPriceFor(currentPrice, quantity, bulk);
  // Sepet/sunucuyla AYNI fonksiyon (lib/cart-pricing.ts): satır toplamı yuvarlanmaz; Havale indirimi ürünün oranından gelir
  const rules = { couponAllowed: product.couponAllowed ?? true, pickupPct: product.pickupDiscountPct ?? null, transferPct: product.transferDiscountPct ?? null };
  const priced = priceCart({
    lines: [{ variationId: selectedVariation?.id ?? "v", productId: product.id, price: currentPrice, quantity, tiers: bulk, ...rules }],
    shippingType: SHIPPING_TYPES.HOME,
    paymentMethod: "BANK_TRANSFER",
    maxTotalDiscountPct,
  });
  const lineNow = priced.itemsTotal;
  const hasDiscount = Boolean(listShown && listShown > currentPrice) || unitNow < currentPrice;
  const notes = withShowcaseNote(ruleNotes(rules), ladderCtx.coupon?.code); // "XXX kuponu kullanılamamaktadır" notundaki kod vitrin kuponundan gelir
  const maxQty = selectedVariation ? Math.max(0, selectedVariation.stock) : 0;
  const outOfStock = !selectedVariation || maxQty <= 0;
  const lowStockText = lowStock && selectedVariation ? lowStockLabel(selectedVariation.stock, lowStock) : null; // seçili varyasyonun gerçek stoğu; ayar kapalıysa null
  const soldOut = product.variations.every((v) => v.stock <= 0); // tüm seçenekler tükendi: satın alma bölümü yerine stok sorma
  const priceOnRequest = !soldOut && !isPurchasablePrice(currentPrice); // fiyatı 0/altı: "Sepete ekle" yerine "Fiyat için sorun"
  const priceMessage = `Merhaba, ${product.title}${product.modelCode ? ` (Model: ${product.modelCode})` : ""} avizesinin güncel fiyatını öğrenmek istiyorum: ${SITE_URL}/urun/${product.id}`;
  const fav = isFavorite(product.id);
  const freeShipping = currentPrice >= FREE_SHIPPING_THRESHOLD;
  const waMessage = `Merhaba, ${product.title}${product.modelCode ? ` (Model: ${product.modelCode})` : ""} avize modeli hakkında bilgi almak istiyorum: ${SITE_URL}/urun/${product.id}`;
  const stockMessage = `Merhaba, ${product.modelCode ? `${product.modelCode} model kodlu ` : ""}'${product.title}' ürününün stoğu ne zaman gelir? ${SITE_URL}/urun/${product.id}`;
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(soldOut ? stockMessage : waMessage)}`;

  const handleAddToCart = () => {
    if (!selectedVariation || outOfStock || priceOnRequest) return;
    if (quantity > maxQty) {
      setQuantity(maxQty);
      toast.error(`Bu seçenekte en fazla ${maxQty} adet stok var.`);
      return;
    }

    addToCart({
      productId: product.id,
      variationId: selectedVariation.id,
      title: product.title,
      imageUrl: coverImageOf(product), // sepet küçük resmi = ürün kapağı (kart ile aynı kural)
      variationName: `${selectedVariation.variationType}: ${selectedVariation.variationValue}`,
      price: currentPrice,
      listPrice: listShown,
      bulk,
      quantity: quantity,
    });

    toast.success("Sepete eklendi", { ...toastHref("/sepet"), description: `${quantity}x ${displayTitle(product.title).title}`, action: { label: "Sepete Git", onClick: () => router.push("/sepet") } });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2500);
  };

  return (
    <div className="bg-raised rounded-3xl border border-line overflow-clip shadow-sm grid grid-cols-1 lg:grid-cols-2 lg:items-start">
      {/* Sol: Büyük Boy Gerçek Avize Fotoğraf Alanı */}
      <div className="flex flex-col bg-neutral-900 lg:sticky lg:top-24 lg:rounded-3xl lg:overflow-hidden">
      <div className="group/gal relative aspect-square w-full overflow-hidden flex items-center justify-center bg-photo">
        {gallery.length > 0 ? (
          <div
            key={gallery.join("|")}
            ref={trackRef}
            data-testid="gallery-track"
            tabIndex={gallery.length > 1 ? 0 : undefined}
            aria-label={gallery.length > 1 ? "Ürün fotoğrafları (sol/sağ ok tuşlarıyla değiştirilir)" : undefined}
            onKeyDown={(e) => {
              if (gallery.length < 2 || zoomed) return; // Büyüt açıkken gezinmeyi lightbox yönetir
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                showImage(activeImage - 1);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                showImage(activeImage + 1);
              }
            }}
            onScroll={(e) => {
              if (programmatic.current) return;
              const el = e.currentTarget;
              const i = Math.round(el.scrollLeft / el.clientWidth);
              if (i !== activeImage && i >= 0 && i < gallery.length) setActiveImage(i);
            }}
            className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bronze-ink"
          >
            {gallery.map((src, i) => (
              <div key={src} className="relative shrink-0 w-full h-full snap-center">
                <HoverMagnifier src={src} alt={i === 0 ? product.title : `${product.title} ${i + 1}. fotoğraf`} onZoom={() => setZoomed(true)} eager={i === 0} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-amber-400/80 p-8 text-center">
            <span className="text-4xl block mb-2">💡</span>
            <span className="text-xs uppercase tracking-widest text-ink-subtle">Yıldırım Avize</span>
          </div>
        )}

        {gallery.length > 1 && (
          <>
            <span data-testid="gallery-counter" aria-live="polite" className="absolute top-4 left-4 z-10 bg-zinc-900/80 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full tabular-nums pointer-events-none">
              {activeImage + 1} / {gallery.length}
            </span>
            {activeImage > 0 && (
              <button type="button" aria-label="Önceki fotoğraf" onClick={() => showImage(activeImage - 1)} className={`${galleryArrow} left-3`}>
                <ChevronLeft aria-hidden="true" className="w-6 h-6" />
              </button>
            )}
            {activeImage < gallery.length - 1 && (
              <button type="button" aria-label="Sonraki fotoğraf" onClick={() => showImage(activeImage + 1)} className={`${galleryArrow} right-3`}>
                <ChevronRight aria-hidden="true" className="w-6 h-6" />
              </button>
            )}
          </>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" />

        {/* Beyoğlu Mağaza Rozeti */}
        {!soldOut && (
        <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:bottom-6 sm:left-6 pointer-events-none bg-neutral-900/90 border border-neutral-700 text-neutral-200 text-xs px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Beyoğlu Mağazamızda Sergileniyor</span>
        </div>
        )}
      </div>
      {gallery.length > 1 && (
        <div ref={thumbsRef} className="keep-theme bg-neutral-900 flex gap-2 overflow-x-auto p-3 border-t border-neutral-800" role="tablist" aria-label="Ürün fotoğrafları">
          {gallery.map((src, i) => (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={i === activeImage}
              aria-label={`${i + 1}. fotoğraf`}
              onClick={() => showImage(i)}
              className={`shrink-0 w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-lg overflow-hidden border-2 transition-colors ${
                i === activeImage ? "border-amber-500" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={smallImage(src)} alt="" width={72} height={72} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      </div>

      {/* Sağ: Ürün Bilgileri ve Seçenekler */}
      <div className="p-5 sm:p-8 lg:p-12 flex flex-col justify-between space-y-8">
        <div className="space-y-4">
          {product.category.trim() && (
            categoryHref ? (
              <Link
                href={categoryHref}
                data-testid="product-category-link"
                className="inline-block text-xs font-semibold text-bronze-ink uppercase tracking-wider hover:text-bronze-ink hover:underline underline-offset-2 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink"
              >
                {product.category} Serisi
              </Link>
            ) : (
              <span className="text-xs font-semibold text-bronze-ink uppercase tracking-wider">
                {product.category} Serisi
              </span>
            )
          )}
          {product.modelCode && (
            <span className="inline-block text-[11px] font-mono font-semibold text-ink-muted bg-surface border border-line px-2.5 py-1 rounded-md">
              Model Kodu: #{product.modelCode}
            </span>
          )}
          {soldOut && (
            <span data-testid="tukendi-rozet" className="ml-2 inline-block text-xs font-bold text-white bg-zinc-900 px-3 py-1 rounded-md align-middle">
              Tükendi
            </span>
          )}
          <div className="flex items-start gap-3">
            <h1 className="min-w-0 flex-1 break-words text-2xl sm:text-3xl font-serif font-bold leading-tight tracking-tight text-ink">
              {shownTitle.title}
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              {!soldOut && (
                <div className="relative shrink-0 w-11 h-11">
                  <FavoriteButton
                    product={{ id: product.id, title: product.title, category: product.category, basePrice: product.basePrice, imageUrl: coverImageOf(product), variations: product.variations }}
                    className="absolute right-0 top-0 z-10 sm:[&>button]:w-11 sm:[&>button]:h-11 [&>button]:border [&>button]:border-line-strong"
                  />
                </div>
              )}
              <ProductShareButton
                product={{
                  id: product.id,
                  title: product.title,
                  category: product.category,
                  price: isPurchasablePrice(currentPrice) ? currentPrice : null,
                }}
              />
            </div>
          </div>
          {shownTitle.assembled && (
            <span className="inline-block text-[11px] font-semibold text-ink-muted border border-line-strong rounded-md px-2 py-0.5">Montajlı</span>
          )}
          <div className="pt-4">
            <span className="text-xs text-ink-muted block mb-1">{quantity > 1 ? "Toplam Tutar" : "Fiyat"}</span>
            {listShown && listShown > currentPrice && (
              <span className="block text-xs text-ink-muted"><span>Liste fiyatı: </span><span className="line-through">{(listShown * quantity).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span></span>
            )}
            {unitNow < currentPrice && (
              <span className="block text-xs text-ink-muted"><span>İndirimsiz fiyat: </span><span className="line-through">{(currentPrice * quantity).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span></span>
            )}
            <span className={`text-3xl font-bold tabular-nums ${hasDiscount ? priceTone(false).sale : "text-ink"}`}>
              {lineNow.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
            </span>
            {lowStockText && (
              <span data-testid="son-adet-rozet" className="ml-3 inline-block align-middle rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-950">
                {lowStockText}
              </span>
            )}
            <div className="mt-2">
              <InstallmentLink amount={lineNow} />
            </div>
            {bulk.length > 0 && (
              <ul className="mt-2 space-y-1">
                {bulk.map((t) => (
                  <li key={t.minQty} className="text-xs font-semibold text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 w-fit">
                    {activeTier(bulk, quantity)?.minQty === t.minQty ? "✓ " : ""}
                    {bulkLabel(t)}
                  </li>
                ))}
                <li className="text-[11px] text-ink-muted">Aynı ürünün farklı renkleri toplam adede sayılır.</li>
                {maxTotalDiscountPct != null && (
                  <li className="text-[11px] text-ink-muted">
                    Adet indirimi uygulanan ürünlerde kupon, mağazadan teslim ve Havale indirimleri, bir üründe toplam indirim en fazla %{maxTotalDiscountPct.toLocaleString("tr-TR")} olacak şekilde sınırlandırılır.
                  </li>
                )}
              </ul>
            )}
            {quantity > 1 && <p className="mt-3 text-[11px] font-semibold text-ink-muted">Aşağıdaki indirimli fiyatlar 1 adet (birim) içindir.</p>}
            <PriceLadder steps={priceLadder(product, ladderCtx, currentPrice)} itemsTotal={currentPrice} />
            {notes.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {notes.map((n) => (
                  <li key={n} className="text-[11px] text-ink-muted">
                    {n}
                  </li>
                ))}
              </ul>
            )}
            {freeShipping && !soldOut && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-full px-3 py-1">
                <span aria-hidden="true">🚚</span> Ücretsiz Kargo &amp; Hızlı Teslimat
              </p>
            )}
          </div>
        </div>

        {/* Varyasyon Seçimi */}
        {product.variations.length > 0 && (
          <div className="space-y-3 pt-6 border-t border-line">
            <span id="varyasyon-etiketi" className="text-xs font-bold text-ink-muted uppercase tracking-wider block">
              Seçenek Belirleyin:
            </span>
            <div role="radiogroup" aria-labelledby="varyasyon-etiketi" className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
              {product.variations.map((v) => {
                const isSelected = selectedVariation?.id === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={v.stock <= 0}
                    onClick={() => {
                      setSelectedVariation(v);
                      setColorChosen(true);
                      setActiveImage(0);
                      setQuantity((q) => Math.max(1, Math.min(q, v.stock)));
                    }}
                    className={`min-h-[56px] p-3 rounded-xl border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      isSelected
                        ? "border-amber-600 bg-amber-50/50 ring-2 ring-bronze-ink/20"
                        : "border-line hover:border-line-strong bg-raised"
                    }`}
                  >
                    <div className="text-xs font-semibold text-ink">
                      {v.variationValue}
                    </div>
                    <div className="text-[11px] text-ink-muted mt-0.5">
                      {v.extraPrice > 0 ? `+${v.extraPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : "Ek ücret yok"}
                    </div>
                    <div className={`text-[11px] mt-1 font-medium ${v.stock > 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {v.stock > 0 ? `Stok: ${v.stock} adet` : "Tükendi"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Adet ve Sepete Ekleme (tükenmiş üründe: stok sorma + favori) */}
        <div className="space-y-4 pt-6 border-t border-line">
          {soldOut ? (
            <div data-testid="stok-yok-bolumu" className="space-y-3">
              <p className="text-sm font-semibold text-ink">Bu ürün şu an stokta yok</p>
              <a
                href={waUrl}
                data-testid="stok-sor"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full min-h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold py-2.5 transition-colors"
              >
                Stok durumunu sor
              </a>
              <button
                type="button"
                data-testid="favori-ekle"
                aria-pressed={fav}
                onClick={() => toggleFavorite({ id: product.id, title: product.title, category: product.category, basePrice: product.basePrice, imageUrl: coverImageOf(product) })}
                className="flex items-center justify-center gap-2 w-full min-h-11 rounded-xl border border-line-strong text-ink hover:border-bronze-ink text-sm font-semibold py-2.5 transition-colors"
              >
                <Heart aria-hidden="true" className={`w-4 h-4 ${fav ? "fill-red-500 text-red-500" : ""}`} /> {fav ? "Favorilerde" : "Favorilere ekle"}
              </button>
            </div>
          ) : (
            <>
          {priceOnRequest ? (
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(priceMessage)}`}
              data-testid="fiyat-sor"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full min-h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold py-2.5 transition-colors"
            >
              Fiyat için sorun
            </a>
          ) : (
          <div className="flex items-center gap-4">
              <div className="flex items-center border border-line-strong rounded-xl overflow-hidden bg-surface">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Adedi azalt"
                  className="min-w-11 min-h-11 px-3.5 hover:bg-line text-sm font-semibold transition-colors"
                >
                  -
                </button>
                <span aria-live="polite" className="min-w-8 text-center text-sm font-bold text-ink">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  disabled={quantity >= maxQty}
                  aria-label="Adedi artır"
                  className="min-w-11 min-h-11 px-3.5 hover:bg-line text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
  
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={outOfStock}
                className="flex-1 min-h-11 bg-ink hover:bg-bronze-ink text-canvas font-medium py-3 px-4 sm:px-6 rounded-xl transition-colors shadow-sm text-sm disabled:opacity-50 disabled:hover:bg-ink disabled:cursor-not-allowed"
              >
                {outOfStock ? "Stokta Yok" : addedToCart ? "✓ Sepete Eklendi!" : "Sepete Ekle"}
              </button>
            </div>
          )}

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-sm font-semibold py-2.5 transition-colors"
            >
              WhatsApp ile Bu Ürünü Sor
            </a>
            </>
          )}

          {!soldOut && (
          <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
            <span aria-hidden="true" className="text-base">📍</span>
            <div>
              <strong className="font-semibold">Beyoğlu Mağazasından Teslim Alabilirsiniz</strong>
              <p className="mt-1 text-amber-900/80">Mağazadan teslim seçeneğinde sepette %{Math.round(PICKUP_DISCOUNT * 100)} ek indirim uygulanır</p>
            </div>
          </div>
          )}
        </div>

        {/* Açıklama ve notlar: satın alma bloğunun altında; uzun metin kısaltılır */}
        <div className="space-y-4 pt-6 border-t border-line">
          {product.description && (
            <div>
              <p id="urun-aciklama" className={`text-sm text-ink-muted leading-7 whitespace-pre-line ${longDesc && !descOpen ? "line-clamp-5" : ""}`}>
                {product.description}
              </p>
              {longDesc && (
                <button
                  type="button"
                  aria-expanded={descOpen}
                  aria-controls="urun-aciklama"
                  onClick={() => setDescOpen((o) => !o)}
                  className="mt-1 min-h-11 text-sm font-semibold text-bronze-ink underline underline-offset-2 hover:text-bronze-ink rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink"
                >
                  {descOpen ? "Daha az göster" : "Devamını göster"}
                </button>
              )}
            </div>
          )}

          <ul className="space-y-2 text-xs">
            {bulbNote === "gift" && (
              <li className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-emerald-950">
                <span aria-hidden="true">💡</span>
                <span>
                  <strong>LED Ampul Hediye</strong> – Ürünle birlikte LED ampuller hediye olarak gönderilir.
                </span>
              </li>
            )}
            {bulbNote === "not-included" && (
              <li className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-amber-950">
                <span aria-hidden="true">💡</span>
                <span>
                  <strong>Ampul Dahil Değildir</strong> (Standart E14/E27 LED ampullerle uyumludur)
                </span>
              </li>
            )}
            {!isAccessoryCategory(product.category) && (
            <li className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink">
              <span aria-hidden="true">📏</span>
              <span>
                <strong>Ölçü &amp; Tavan Uyumu:</strong> Özel ölçü ve tavan yükseklik talepleriniz için{" "}
                <a href="/iletisim" className="text-bronze-ink underline font-semibold">İletişim</a> bölümünden bize ulaşabilir veya sipariş notunda zincir/bakla payını belirtebilirsiniz.
              </span>
            </li>
            )}
          </ul>
        </div>
        {/* Mobil yapışkan çubuğun içeriği örtmemesi için alt boşluk */}
        {!priceOnRequest && <div aria-hidden="true" className="md:hidden h-16" />}
      </div>

      {/* Mobil yapışkan satın alma çubuğu (md altı): sağdaki yüzen telefon/WhatsApp düğmeleri için sağ boşluk bırakılır */}
      {!priceOnRequest && (
        <div
          data-testid="mobil-satin-alma-cubugu"
          className="md:hidden fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-line bg-raised pl-4 pr-28 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_-8px_rgba(24,24,27,0.25)]"
        >
          <div className="min-w-0 shrink-0">
            <span className="block text-[11px] text-ink-muted">{soldOut || outOfStock ? "Tükendi" : quantity > 1 ? "Toplam Tutar" : "Fiyat"}</span>
            <span className={`block text-lg font-bold tabular-nums leading-tight ${hasDiscount ? priceTone(false).sale : "text-ink"}`}>
              {lineNow.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={soldOut || outOfStock}
            className="flex-1 min-w-0 min-h-11 bg-ink hover:bg-bronze-ink text-canvas font-medium py-2.5 px-3 rounded-xl transition-colors text-sm disabled:opacity-50 disabled:hover:bg-ink disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink"
          >
            {soldOut || outOfStock ? "Tükendi" : addedToCart ? "✓ Eklendi" : "Sepete Ekle"}
          </button>
        </div>
      )}

      {zoomed && mainImage && (
        <ImageLightbox src={mainImage} alt={product.title} onClose={() => setZoomed(false)} nav={{ count: gallery.length, index: activeImage, onChange: showImage }} />
      )}
    </div>
  );
}
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HoverMagnifier, ImageLightbox } from "@/components/ImageZoom";
import { useCart } from "@/context/CartContext";
import { BANK_TRANSFER_DISCOUNT, FREE_SHIPPING_THRESHOLD, PICKUP_DISCOUNT } from "@/lib/pricing";
import { SITE_URL, WHATSAPP_NUMBER } from "@/lib/site";
import { activeTier, bulkLabel, bulkTiersOf, lineTotalFor, unitPriceFor } from "@/lib/bulk-pricing";

interface Variation {
  id: string;
  variationType: string;
  variationValue: string;
  extraPrice: number;
  stock: number;
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
  variations: Variation[];
}

export default function ProductDetailClient({ product }: { product: Product }) {
  const { addToCart } = useCart();

  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(
    product.variations.find((v) => v.stock > 0) || product.variations[0] || null
  );
  const gallery = Array.from(new Set([product.imageUrl, ...(product.images ?? [])].filter((u): u is string => Boolean(u))));
  const [activeImage, setActiveImage] = useState(0);
  const mainImage = gallery[activeImage] ?? null;
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const currentPrice = product.basePrice + (selectedVariation?.extraPrice || 0);
  const listShown = product.listPrice && product.listPrice > product.basePrice ? product.listPrice + (selectedVariation?.extraPrice || 0) : null;
  const bulk = bulkTiersOf(product);
  const unitNow = unitPriceFor(currentPrice, quantity, bulk);
  const maxQty = selectedVariation ? Math.max(0, selectedVariation.stock) : 0;
  const outOfStock = !selectedVariation || maxQty <= 0;
  const freeShipping = currentPrice >= FREE_SHIPPING_THRESHOLD;
  const waMessage = `Merhaba, ${product.title}${product.modelCode ? ` (Model: ${product.modelCode})` : ""} avize modeli hakkında bilgi almak istiyorum: ${SITE_URL}/urun/${product.id}`;
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  const handleAddToCart = () => {
    if (!selectedVariation || outOfStock) return;
    if (quantity > maxQty) {
      setQuantity(maxQty);
      toast.error(`Bu seçenekte en fazla ${maxQty} adet stok var.`);
      return;
    }

    addToCart({
      productId: product.id,
      variationId: selectedVariation.id,
      title: product.title,
      imageUrl: product.imageUrl,
      variationName: `${selectedVariation.variationType}: ${selectedVariation.variationValue}`,
      price: currentPrice,
      bulk,
      quantity: quantity,
    });

    toast.success("Sepete eklendi", { description: `${quantity}x ${product.title}`, action: { label: "Sepete Git", onClick: () => (window.location.href = "/sepet") } });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2500);
  };

  return (
    <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-2">
      {/* Sol: Büyük Boy Gerçek Avize Fotoğraf Alanı */}
      <div className="flex flex-col bg-neutral-900">
      <div className="relative min-h-[320px] sm:min-h-[440px] flex-1 overflow-hidden flex items-center justify-center">
        {mainImage ? (
          <HoverMagnifier key={mainImage} src={mainImage} alt={product.title} onZoom={() => setZoomed(true)} />
        ) : (
          <div className="text-amber-400/80 p-8 text-center">
            <span className="text-4xl block mb-2">💡</span>
            <span className="text-xs uppercase tracking-widest text-neutral-400">Yıldırım Avize</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Beyoğlu Mağaza Rozeti */}
        <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:bottom-6 sm:left-6 pointer-events-none bg-neutral-900/90 border border-neutral-700 text-neutral-200 text-xs px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Beyoğlu Mağazamızda Sergileniyor</span>
        </div>
      </div>
      {gallery.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-3 border-t border-neutral-800" role="tablist" aria-label="Ürün fotoğrafları">
          {gallery.map((src, i) => (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={i === activeImage}
              aria-label={`${i + 1}. fotoğraf`}
              onClick={() => setActiveImage(i)}
              className={`shrink-0 w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-lg overflow-hidden border-2 transition-colors ${
                i === activeImage ? "border-amber-500" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" width={72} height={72} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      </div>

      {/* Sağ: Ürün Bilgileri ve Seçenekler */}
      <div className="p-5 sm:p-8 lg:p-12 flex flex-col justify-between space-y-8">
        <div className="space-y-4">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
            {product.category} Serisi
          </span>
          {product.modelCode && (
            <span className="inline-block text-[11px] font-mono font-semibold text-neutral-700 bg-neutral-100 border border-neutral-200 px-2.5 py-1 rounded-md">
              Model Kodu: #{product.modelCode}
            </span>
          )}
          <h1 className="text-2xl sm:text-3xl font-serif font-bold leading-tight tracking-tight text-neutral-900">
            {product.title}
          </h1>
          <p className="text-sm text-neutral-700 leading-7 whitespace-pre-line">
            {product.description}
          </p>

          <ul className="space-y-2 pt-1 text-xs">
            <li className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-amber-950">
              <span aria-hidden="true">💡</span>
              <span>
                <strong>Ampul Dahil Değildir</strong> (Standart E14/E27 LED ampullerle uyumludur)
              </span>
            </li>
            <li className="flex items-start gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-neutral-800">
              <span aria-hidden="true">📏</span>
              <span>
                <strong>Ölçü &amp; Tavan Uyumu:</strong> Özel ölçü ve tavan yükseklik talepleriniz için{" "}
                <a href="/iletisim" className="text-amber-700 underline font-semibold">İletişim</a> bölümünden bize ulaşabilir veya sipariş notunda zincir/bakla payını belirtebilirsiniz.
              </span>
            </li>
          </ul>

          <div className="pt-4">
            <span className="text-xs text-neutral-500 block mb-1">Toplam Tutar</span>
            {listShown && listShown > currentPrice && (
              <span className="block text-sm text-neutral-500 line-through">{(listShown * quantity).toLocaleString("tr-TR")} ₺</span>
            )}
            {unitNow < currentPrice && (
              <span className="block text-sm text-neutral-500 line-through">{(currentPrice * quantity).toLocaleString("tr-TR")} ₺</span>
            )}
            <span className="text-3xl font-bold tabular-nums text-neutral-900">
              {lineTotalFor(currentPrice, quantity, bulk).toLocaleString("tr-TR")} ₺
            </span>
            {bulk.length > 0 && (
              <ul className="mt-2 space-y-1">
                {bulk.map((t) => (
                  <li key={t.minQty} className="text-xs font-semibold text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 w-fit">
                    {activeTier(bulk, quantity)?.minQty === t.minQty ? "✓ " : ""}
                    {bulkLabel(t)}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 w-fit">
              Havale/EFT ile %{Math.round(BANK_TRANSFER_DISCOUNT * 100)} İndirimli: <strong>{Math.round(lineTotalFor(currentPrice, quantity, bulk) * (1 - BANK_TRANSFER_DISCOUNT)).toLocaleString("tr-TR")} ₺</strong>
            </p>
            {freeShipping && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-full px-3 py-1">
                <span aria-hidden="true">🚚</span> Ücretsiz &amp; Sigortalı Kargo
              </p>
            )}
          </div>
        </div>

        {/* Varyasyon Seçimi */}
        {product.variations.length > 0 && (
          <div className="space-y-3 pt-6 border-t border-neutral-100">
            <span id="varyasyon-etiketi" className="text-xs font-bold text-neutral-700 uppercase tracking-wider block">
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
                      setQuantity((q) => Math.max(1, Math.min(q, v.stock)));
                    }}
                    className={`min-h-[56px] p-3 rounded-xl border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      isSelected
                        ? "border-amber-600 bg-amber-50/50 ring-2 ring-amber-600/20"
                        : "border-neutral-200 hover:border-neutral-300 bg-white"
                    }`}
                  >
                    <div className="text-xs font-semibold text-neutral-900">
                      {v.variationValue}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {v.extraPrice > 0 ? `+${v.extraPrice} ₺` : "Fark Yok"}
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

        {/* Adet ve Sepete Ekleme */}
        <div className="space-y-4 pt-6 border-t border-neutral-100">
          <div className="flex items-center gap-4">
            <div className="flex items-center border border-neutral-300 rounded-xl overflow-hidden bg-neutral-50">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Adedi azalt"
                className="min-w-11 min-h-11 px-3.5 hover:bg-neutral-200 text-sm font-semibold transition-colors"
              >
                -
              </button>
              <span aria-live="polite" className="min-w-8 text-center text-sm font-bold text-neutral-800">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                disabled={quantity >= maxQty}
                aria-label="Adedi artır"
                className="min-w-11 min-h-11 px-3.5 hover:bg-neutral-200 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={outOfStock}
              className="flex-1 min-h-11 bg-neutral-900 hover:bg-amber-600 text-white font-medium py-3 px-4 sm:px-6 rounded-xl transition-colors shadow-sm text-sm disabled:opacity-50 disabled:hover:bg-neutral-900 disabled:cursor-not-allowed"
            >
              {outOfStock ? "Stokta Yok" : addedToCart ? "✓ Sepete Eklendi!" : "Sepete Ekle"}
            </button>
          </div>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-sm font-semibold py-2.5 transition-colors"
          >
            WhatsApp ile Bu Ürünü Sor
          </a>

          <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
            <span aria-hidden="true" className="text-base">📍</span>
            <div>
              <strong className="font-semibold">Beyoğlu Mağazasından Teslim Alabilirsiniz</strong>
              <p className="mt-1 text-amber-900/80">Mağazadan teslim seçeneğinde sepette %{Math.round(PICKUP_DISCOUNT * 100)} ek indirim uygulanır</p>
            </div>
          </div>
        </div>
      </div>

      {zoomed && mainImage && (
        <ImageLightbox src={mainImage} alt={product.title} onClose={() => setZoomed(false)} />
      )}
    </div>
  );
}
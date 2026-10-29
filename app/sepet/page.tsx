"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCart } from "@/context/CartContext";
import { COUPONS, computeTotals, FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from "@/lib/pricing";
import BankTransferCard from "@/components/BankTransferCard";

interface LocationItem {
  id: number;
  name: string;
}

export default function CartPage() {
  const router = useRouter();
  const { cart, removeFromCart, updateQuantity, clearCart, totalPrice } = useCart();

  // 1. Teslimat Yöntemi
  const [shippingType, setShippingType] = useState<string>("BEYOGLU_MAGAZA_TESLIM");

  // 2. Ödeme Yöntemi
  const [paymentMethod, setPaymentMethod] = useState<"CREDIT_CARD" | "BANK_TRANSFER">("CREDIT_CARD");

  // 4. Kupon Kodu Yönetimi
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; type: "percent" | "fixed"; value: number } | null>(null);
  const [couponError, setCouponError] = useState("");

  // PayTR iFrame token'ı (kart bilgileri sitemizde toplanmaz)
  const [paytrToken, setPaytrToken] = useState<string | null>(null);
  const [paymentFailed, setPaymentFailed] = useState(false);

  // 6. Müşteri İletişim & Kargonomi Şehir/İlçe Bilgileri
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [states, setStates] = useState<LocationItem[]>([]);
  const [cities, setCities] = useState<LocationItem[]>([]);
  const [buyerStateId, setBuyerStateId] = useState<number>(34);
  const [buyerCityId, setBuyerCityId] = useState<number>(425);

  const [loading, setLoading] = useState(false);

  // PayTR başarısız ödeme dönüşü
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL parametresi ilk render sonrası okunur
    if (new URLSearchParams(window.location.search).get("odeme") === "basarisiz") setPaymentFailed(true);
  }, []);

  // Kargonomi Şehir Listesini Yükle
  useEffect(() => {
    fetch("/api/kargonomi/locations")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.states) && data.states.length > 0) {
          setStates(data.states);
        }
      })
      .catch(() => {});
  }, []);

  // Seçilen Şehre Göre Kargonomi İlçelerini Yükle
  useEffect(() => {
    if (!buyerStateId) return;
    fetch(`/api/kargonomi/locations?stateId=${buyerStateId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.cities) && data.cities.length > 0) {
          setCities(data.cities);
          setBuyerCityId(Number(data.cities[0].id));
        }
      })
      .catch(() => {});
  }, [buyerStateId]);

  // Tutarlar (sunucu aynı hesabı yapar)
  const { shipping: shippingCost, couponDiscount, pickupDiscount, bankDiscount, total: finalTotal } = computeTotals({
    itemsTotal: totalPrice,
    shippingType,
    couponCode: appliedCoupon?.code,
    paymentMethod,
  });

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError("");
    const code = couponInput.trim().toUpperCase();

    const coupon = COUPONS[code];
    if (coupon) {
      setAppliedCoupon({ code, ...coupon });
    } else {
      setCouponError("Geçersiz veya süresi dolmuş kupon kodu.");
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    const selectedStateObj = states.find((s) => Number(s.id) === Number(buyerStateId));
    const selectedCityObj = cities.find((c) => Number(c.id) === Number(buyerCityId));

    setLoading(true);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          address,
          buyerStateId,
          buyerCityId,
          buyerStateName: selectedStateObj?.name || "İSTANBUL",
          buyerCityName: selectedCityObj?.name || "MERKEZ",
          shippingType,
          paymentMethod,
          couponCode: appliedCoupon?.code,
          items: cart,
        }),
      });

      const data = await res.json();
      if (data.success && data.paytrToken) {
        // Kartlı ödeme: PayTR güvenli iFrame formu açılır; sepet ödeme onayından sonra temizlenir
        setPaytrToken(data.paytrToken);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (data.success) {
        clearCart();
        router.push(`/siparis-onay/${data.orderId}`);
      } else {
        alert("Sipariş oluşturulamadı: " + data.error);
      }
    } catch {
      alert("Bir bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  if (paytrToken) {
    return (
      <main className="min-h-screen bg-neutral-50 py-10 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-neutral-200 p-4 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-serif font-bold text-neutral-900">Güvenli Ödeme</h1>
            <button
              type="button"
              onClick={() => setPaytrToken(null)}
              className="text-xs font-semibold text-neutral-500 hover:text-amber-700"
            >
              ← Sepete Dön
            </button>
          </div>
          <iframe
            id="paytriframe"
            title="PayTR güvenli ödeme formu"
            src={`https://www.paytr.com/odeme/guvenli/${paytrToken}`}
            className="w-full border-0"
            style={{ minHeight: 640 }}
          />
          <Script src="https://www.paytr.com/js/iframeResizer.min.js" strategy="afterInteractive" onLoad={() => {
            (window as unknown as { iFrameResize?: (o: object, s: string) => void }).iFrameResize?.({}, "#paytriframe");
          }} />
          <p className="text-[11px] text-neutral-400 text-center">
            Ödeme tamamlandığında siparişiniz onaylanır ve e-posta ile bilgilendirilirsiniz.
          </p>
        </div>
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main className="min-h-screen bg-neutral-50 py-20 px-4 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <span className="text-5xl block">🛍️</span>
          <h2 className="text-2xl font-serif font-bold text-neutral-900">
            Sepetiniz Henüz Boş
          </h2>
          <p className="text-sm text-neutral-500">
            Beyoğlu koleksiyonumuzun kristal ve modern avizelerini keşfedin.
          </p>
          <Link
            href="/"
            className="inline-block bg-neutral-900 hover:bg-amber-600 text-white text-xs font-semibold px-6 py-3 rounded-xl transition-colors mt-4"
          >
            Koleksiyonu İncele →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
      {paymentFailed && (
        <div role="alert" className="max-w-6xl mx-auto mb-6 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-xs p-4">
          Ödeme tamamlanamadı. Sepetiniz korunuyor; tekrar deneyebilir veya Havale/EFT seçebilirsiniz.
        </div>
      )}
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-serif font-bold text-neutral-900 mb-8">
          Alışveriş Sepeti & Güvenli Ödeme
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sol Kolon */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ürün Listesi */}
            <div className="space-y-4">
              {cart.map((item) => (
                <div
                  key={item.variationId}
                  className="bg-white rounded-2xl border border-neutral-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                >
                  <div>
                    <h3 className="font-serif font-bold text-neutral-900 text-base">
                      {item.title}
                    </h3>
                    <span className="inline-block text-xs bg-amber-50 text-amber-800 font-medium px-2.5 py-0.5 rounded-md mt-1">
                      {item.variationName}
                    </span>
                    <div className="text-sm font-bold text-neutral-900 mt-2">
                      {item.price.toLocaleString("tr-TR")} ₺
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="flex items-center border border-neutral-300 rounded-lg overflow-hidden bg-neutral-50">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.variationId, item.quantity - 1)}
                        className="px-2.5 py-1 text-xs font-bold hover:bg-neutral-200"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 text-xs font-bold text-neutral-800">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.variationId, item.quantity + 1)}
                        className="px-2.5 py-1 text-xs font-bold hover:bg-neutral-200"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.variationId)}
                      className="text-neutral-400 hover:text-red-600 transition-colors p-1 text-sm"
                      title="Kaldır"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* KUPON KODU GİRİŞ KUTUSU */}
            <div className="bg-white rounded-3xl border border-neutral-200 p-6 shadow-sm space-y-3">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider block">
                İndirim / Kupon Kodu:
              </label>

              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs">
                  <div className="flex items-center gap-2 text-emerald-900">
                    <span className="text-base">✓</span>
                    <span>
                      <strong>{appliedCoupon.code}</strong> kuponu uygulandı:{" "}
                      <strong>
                        {appliedCoupon.type === "percent" ? `%${appliedCoupon.value} İndirim` : `${appliedCoupon.value} ₺ İndirim`}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Kuponu Kaldır
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input aria-label="Kupon kodu"
                    type="text"
                    placeholder="Promosyon kodu (YILDIRIM5)"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    className="flex-1 text-xs p-3 rounded-xl border border-neutral-300 font-mono uppercase focus:outline-none focus:border-amber-600"
                  />
                  <button
                    type="submit"
                    className="bg-neutral-900 hover:bg-amber-600 text-white text-xs font-semibold px-5 py-3 rounded-xl transition-colors shrink-0"
                  >
                    Kuponu Uygula
                  </button>
                </form>
              )}

              {couponError && (
                <p className="text-xs text-red-600 font-medium">{couponError}</p>
              )}
            </div>

            {/* Teslimat Tercihi */}
            <div className="bg-white rounded-3xl border border-neutral-200 p-6 space-y-3 shadow-sm">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider block">
                Teslimat Yöntemini Seçin:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setShippingType("BEYOGLU_MAGAZA_TESLIM")}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    shippingType === "BEYOGLU_MAGAZA_TESLIM"
                      ? "border-amber-600 bg-amber-50/60 ring-2 ring-amber-600/20"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-900">
                    <span>📍 Mağazadan Teslim</span>
                    <span className="text-emerald-600 font-bold">Ücretsiz • %3 İndirim</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Şişhane merkezimizden görerek teslimat. Kırılma riski sıfır; sepet tutarına ekstra %3 indirim uygulanır.
                  </p>
                </div>

                <div
                  onClick={() => setShippingType("STANDART_KARGO")}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    shippingType === "STANDART_KARGO"
                      ? "border-amber-600 bg-amber-50/60 ring-2 ring-amber-600/20"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-900">
                    <span>📦 Adrese Teslim</span>
                    <span className="text-neutral-700 font-bold">
                      {totalPrice >= FREE_SHIPPING_THRESHOLD ? "Ücretsiz" : `${SHIPPING_COST} ₺`}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Kırılmalara karşı üst düzey korumalı kolide sigortalı teslimat. {FREE_SHIPPING_THRESHOLD} ₺ ve üzeri siparişlerde kargo ücretsiz.
                  </p>
                </div>
              </div>
            </div>

            {/* Ödeme Bilgileri */}
            <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 space-y-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                <div>
                  <h2 className="text-lg font-serif font-bold text-neutral-900">
                    Ödeme Bilgileri
                  </h2>
                  <p className="text-xs text-neutral-500">
                    256-Bit SSL ve 3D Secure korumalı güvenli ödeme
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-400">
                  <span className="bg-neutral-100 px-2 py-1 rounded text-[10px] text-neutral-600">troy</span>
                  <span className="bg-neutral-100 px-2 py-1 rounded text-[10px] text-neutral-600">VISA</span>
                  <span className="bg-neutral-100 px-2 py-1 rounded text-[10px] text-neutral-600">mastercard</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CREDIT_CARD")}
                  className={`p-3 rounded-xl border text-xs font-semibold transition-all ${
                    paymentMethod === "CREDIT_CARD"
                      ? "border-amber-600 bg-amber-50/60 text-amber-950 ring-2 ring-amber-600/20"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  }`}
                >
                  💳 Kredi / Banka Kartı
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("BANK_TRANSFER")}
                  className={`p-3 rounded-xl border text-xs font-semibold transition-all ${
                    paymentMethod === "BANK_TRANSFER"
                      ? "border-amber-600 bg-amber-50/60 text-amber-950 ring-2 ring-amber-600/20"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  }`}
                >
                  🏦 Havale / EFT (%5 İndirimli)
                </button>
              </div>

              {paymentMethod === "CREDIT_CARD" ? (
                <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs text-neutral-700 space-y-1.5">
                  <div className="font-bold">🔒 PayTR Güvenli Ödeme</div>
                  <p className="text-neutral-600">
                    &ldquo;Ödemeye Geç&rdquo; dediğinizde kart bilgilerinizi PayTR&apos;nin güvenli ödeme formuna girersiniz.
                    Kart bilgileriniz sitemizde saklanmaz veya görüntülenmez. Taksit seçenekleri kartınıza göre formda listelenir.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <BankTransferCard />
                  <div className="font-semibold text-emerald-700 text-xs">
                    ✓ Havale ödemelerinde %5 nakit indirimi otomatik uygulanmıştır.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sağ Kolon: Özet */}
          <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 space-y-6 shadow-sm h-fit">
            <h2 className="text-lg font-serif font-bold text-neutral-900 pb-3 border-b border-neutral-100">
              Sipariş Özeti
            </h2>

            <form onSubmit={handleCheckout} className="space-y-3">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider block">
                Teslimat & Kargonomi Alıcı Bilgileri:
              </label>

              <input aria-label="Adınız Soyadınız (En az 2 kelime)"
                required
                type="text"
                placeholder="Adınız Soyadınız (En az 2 kelime)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600"
              />
              <input aria-label="E-posta Adresiniz"
                required
                type="email"
                placeholder="E-posta Adresiniz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600"
              />
              <input aria-label="Telefon Numaranız (Örn: 0555 123 45 67)"
                required
                type="tel"
                placeholder="Telefon Numaranız (Örn: 0555 123 45 67)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600"
              />

              {/* Kargonomi Şehir (State) ve İlçe (City) Seçimi */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase block mb-1">
                    İl (Şehir)
                  </label>
                  <select
                    value={buyerStateId}
                    onChange={(e) => setBuyerStateId(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:border-amber-600"
                  >
                    {states.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase block mb-1">
                    İlçe
                  </label>
                  <select
                    value={buyerCityId}
                    onChange={(e) => setBuyerCityId(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:border-amber-600"
                  >
                    {cities.map((ct) => (
                      <option key={ct.id} value={ct.id}>
                        {ct.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <textarea aria-label="Açık Teslimat Adresiniz (Mahalle, Sokak, Bina ve Daire No)"
                required
                rows={2}
                placeholder="Açık Teslimat Adresiniz (Mahalle, Sokak, Bina ve Daire No)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600"
              />

              {/* Fiyat Dökümü */}
              <div className="space-y-2 pt-4 border-t border-neutral-100 text-xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Ürünler Toplamı</span>
                  <span>{totalPrice.toLocaleString("tr-TR")} ₺</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Kargo / Teslimat</span>
                  <span>{shippingCost === 0 ? "Ücretsiz" : `${shippingCost} ₺`}</span>
                </div>

                {/* Kupon İndirimi */}
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Kupon ({appliedCoupon?.code})</span>
                    <span>-{couponDiscount.toLocaleString("tr-TR")} ₺</span>
                  </div>
                )}

                {/* Mağazadan Teslim İndirimi */}
                {pickupDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Mağazadan Teslim İndirimi (%3)</span>
                    <span>-{pickupDiscount.toLocaleString("tr-TR")} ₺</span>
                  </div>
                )}

                {/* Havale İndirimi */}
                {bankDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Havale İndirimi (%5)</span>
                    <span>-{bankDiscount.toLocaleString("tr-TR")} ₺</span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-bold text-neutral-900 pt-2 border-t border-neutral-200">
                  <span>Toplam Tutar</span>
                  <span className="text-amber-600 text-base">{finalTotal.toLocaleString("tr-TR")} ₺</span>
                </div>

              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-neutral-900 hover:bg-amber-600 text-white py-3.5 px-4 rounded-xl transition-colors text-xs font-semibold shadow-sm mt-4 disabled:opacity-50"
              >
                {loading
                  ? "Hazırlanıyor..."
                  : paymentMethod === "CREDIT_CARD"
                  ? `🔒 Ödemeye Geç (${finalTotal.toLocaleString("tr-TR")} ₺)`
                  : `Siparişi Tamamla (${finalTotal.toLocaleString("tr-TR")} ₺)`}
              </button>

              <div className="text-center pt-2 text-[10px] text-neutral-400">
                🔒 256-Bit SSL & Kargonomi Entegre Lojistik Güvencesi
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
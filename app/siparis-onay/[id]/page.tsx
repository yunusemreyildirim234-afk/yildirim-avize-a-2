import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ClearCart from "@/components/ClearCart";

export const metadata: Metadata = {
  title: "Siparişiniz Alındı",
  robots: { index: false, follow: false },
};

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: { select: { name: true } }, items: { include: { variation: { include: { product: true } } } } },
  });
  if (!order) notFound();

  const isPickup = order.shippingType === "BEYOGLU_MAGAZA_TESLIM";
  const awaitingPayment = order.status === "AWAITING_PAYMENT";
  const paymentFailed = order.status === "PAYMENT_FAILED";

  return (
    <main className="min-h-screen bg-neutral-50 py-12 sm:py-16 px-4">
      {!paymentFailed && <ClearCart />}
      <div className="max-w-xl mx-auto bg-white rounded-3xl border border-neutral-200 p-6 sm:p-12 text-center space-y-6 shadow-sm">
        <div
          aria-hidden="true"
          className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold"
        >
          ✓
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900">
          {paymentFailed ? "Ödeme Tamamlanamadı" : awaitingPayment ? "Ödemeniz Onaylanıyor" : "Teşekkürler, Siparişiniz Alındı!"}
        </h1>
        <p className="text-sm text-neutral-600">
          {paymentFailed
            ? "Ödemeniz alınamadı. Sepete dönerek tekrar deneyebilirsiniz."
            : awaitingPayment
            ? "Ödeme bilginiz bankadan onaylanıyor. Birkaç saniye içinde sayfayı yenileyin; onaylanınca e-posta ile bilgilendirileceksiniz."
            : <>Sayın <strong>{order.user.name}</strong>, siparişiniz atölyemize iletildi. Onay ve gelişmeler e-posta ile bildirilecektir.</>}
        </p>

        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 text-xs text-left space-y-3">
          <div>
            <span className="text-neutral-400">Sipariş Takip Kodu:</span>
            <p className="font-mono font-bold text-neutral-800 break-all">{order.id}</p>
          </div>
          <ul className="pt-3 border-t border-neutral-200 space-y-1">
            {order.items.map((item) => (
              <li key={item.id} className="text-neutral-700">
                {item.quantity}x <strong>{item.variation.product.title}</strong> – {item.variation.variationValue}
              </li>
            ))}
          </ul>
          <div className="pt-3 border-t border-neutral-200">
            <span className="text-neutral-400">Toplam:</span>
            <p className="font-bold text-neutral-900 text-sm">{order.totalAmount.toLocaleString("tr-TR")} ₺</p>
          </div>
          <div className="pt-3 border-t border-neutral-200">
            <span className="text-neutral-400">Teslimat:</span>
            <p className="font-semibold text-neutral-800">
              {isPickup
                ? "📍 Beyoğlu Şişhane mağazamızdan teslim alınacak"
                : "📦 Sigortalı üst düzey korumalı koli ile adresinize gönderilecek"}
            </p>
            {order.kargonomiShipmentId && (
              <p className="text-neutral-600 mt-1">
                Kargo kaydı: <strong className="font-mono">#{order.kargonomiShipmentId}</strong>
                {order.shippingBarcode && (
                  <>
                    {" "}• Barkod: <strong className="font-mono">{order.shippingBarcode}</strong>
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={`/kargo-takip?code=${order.id}`}
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold px-6 py-3 rounded-xl transition-colors"
          >
            🚚 Kargo & Sipariş Takibi
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto bg-neutral-900 hover:bg-amber-600 text-white text-xs font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Alışverişe Devam Et →
          </Link>
        </div>
      </div>
    </main>
  );
}

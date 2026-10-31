import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ClearCart from "@/components/ClearCart";
import BankTransferCard from "@/components/BankTransferCard";
import ReceiptUpload from "@/components/ReceiptUpload";

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
            : <>Sayın <strong>{order.user.name}</strong>, siparişiniz merkezimize iletildi. Onay ve gelişmeler e-posta ile bildirilecektir.</>}
        </p>

        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 text-xs text-left space-y-3">
          <div>
            <span className="text-neutral-400">Sipariş Takip Kodu:</span>
            <p className="font-mono font-bold text-neutral-800 break-all">{order.id}</p>
          </div>
          <ul className="pt-3 border-t border-neutral-200 space-y-3">
            {order.items.map((item) => (
              <li key={item.id} className="text-neutral-700 flex items-center gap-3">
                <Link
                  href={`/urun/${item.variation.product.id}`}
                  aria-label={`${item.variation.product.title} ürün sayfası`}
                  className="w-[72px] h-[72px] rounded-xl bg-neutral-100 overflow-hidden shrink-0 border border-neutral-200 flex items-center justify-center"
                >
                  {item.variation.product.imageUrl && (
                    <img src={item.variation.product.imageUrl} alt={item.variation.product.title} className="w-full h-full object-cover" />
                  )}
                </Link>
                <span>
                  {item.quantity}x{" "}
                  <Link href={`/urun/${item.variation.product.id}`} className="hover:text-amber-700 hover:underline">
                    <strong>{item.variation.product.title}</strong>
                  </Link>{" "}
                  – {item.variation.variationValue}
                </span>
              </li>
            ))}
          </ul>
          {order.orderNote && (
            <div className="pt-3 border-t border-neutral-200">
              <span className="text-neutral-400">Sipariş Notunuz:</span>
              <p className="font-medium text-neutral-800 whitespace-pre-line">{order.orderNote}</p>
            </div>
          )}
          <div className="pt-3 border-t border-neutral-200">
            <span className="text-neutral-400">Toplam:</span>
            <p className="font-bold text-neutral-900 text-sm">{order.totalAmount.toLocaleString("tr-TR")} ₺</p>
          </div>
          <div className="pt-3 border-t border-neutral-200">
            <span className="text-neutral-400">Teslimat:</span>
            <p className="font-semibold text-neutral-800">
              {isPickup
                ? "📍 Mağazadan Teslim – Şişhane merkezimizden teslim alınacak"
                : "📦 Adrese Teslim – sigortalı korumalı koli ile adresinize gönderilecek"}
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

        {order.paymentMethod === "BANK_TRANSFER" && !paymentFailed && <BankTransferCard orderId={order.id} />}

        {order.paymentMethod === "BANK_TRANSFER" && order.status === "PENDING_NEW" && (
          <div className="text-left space-y-2">
            <p className="text-xs text-neutral-600">Havaleyi yaptıktan sonra dekontunuzu yükleyerek ödemenizin hızla onaylanmasını sağlayabilirsiniz.</p>
            <ReceiptUpload orderId={order.id} uploaded={Boolean(order.receiptUrl)} defaultSender={order.user.name} />
          </div>
        )}

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

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ClearCart from "@/components/ClearCart";
import BankTransferCard from "@/components/BankTransferCard";
import ReceiptUpload from "@/components/ReceiptUpload";
import { maskName } from "@/lib/mask-name";
import { GtmAwaitPayment, GtmEvent } from "@/components/GtmEvent";
import { gaItem, isPurchasable, purchaseEvent, purchaseOnceKey } from "@/lib/gtm-events";
import { feedBrand } from "@/lib/feed";
import { coverImageOf } from "@/lib/variation-input";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Siparişiniz Alındı",
  robots: { index: false, follow: false },
};

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: { select: { name: true } }, items: { include: { variation: { include: { product: { include: { variations: { orderBy: { position: "asc" }, select: { images: true } } } } } } } } },
  });
  if (!order) notFound();

  const isPickup = order.shippingType === "BEYOGLU_MAGAZA_TESLIM";
  const awaitingPayment = order.status === "AWAITING_PAYMENT";
  const paymentFailed = order.status === "PAYMENT_FAILED";
  // Ölçüm (GTM): yalnızca ödemesi alınmış kartlı veya oluşturulmuş havale siparişi; kargo = sabit kural (mağazadan teslim 0, eşik üstü 0, aksi 100 ₺)
  const itemsSum = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const shippingFee = isPickup || itemsSum >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const purchase = isPurchasable(order.status)
    ? purchaseEvent({
        id: order.id,
        total: order.totalAmount,
        shipping: shippingFee,
        paymentType: order.paymentMethod,
        coupon: order.couponCode,
        items: order.items.map((i) => gaItem({ id: i.variation.product.id, name: i.variation.product.title, price: i.unitPrice, quantity: i.quantity, category: i.variation.product.category, brand: feedBrand(i.variation.product.brand), variant: i.variation.variationValue })),
      })
    : null;

  return (
    <main className="min-h-screen bg-neutral-50 py-12 sm:py-16 px-4">
      {purchase && <GtmEvent event={purchase} onceKey={purchaseOnceKey(order.id)} />}
      {awaitingPayment && <GtmAwaitPayment />}
      {!paymentFailed && order.status !== "CANCELLED" && order.status !== "RETURNED" && <ClearCart orderId={order.id} createdAt={order.createdAt.toISOString()} />}
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
            : <>Sayın <strong>{maskName(order.user.name)}</strong>, siparişiniz merkezimize iletildi. Onay ve gelişmeler e-posta ile bildirilecektir.</>}
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
                  {coverImageOf(item.variation.product) && (
                    <img src={coverImageOf(item.variation.product)!} alt={item.variation.product.title} width={64} height={64} loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
            <p className="font-bold text-neutral-900 text-sm">{order.totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</p>
          </div>
          <div className="pt-3 border-t border-neutral-200">
            <span className="text-neutral-400">Teslimat:</span>
            <p className="font-semibold text-neutral-800">
              {isPickup
                ? "📍 Mağazadan Teslim – Şişhane merkezimizden teslim alınacak"
                : "📦 Adrese Teslim – korumalı koli ile adresinize gönderilecek"}
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

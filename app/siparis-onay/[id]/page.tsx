import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ClearCart from "@/components/ClearCart";
import BankTransferCard from "@/components/BankTransferCard";
import ReceiptUpload from "@/components/ReceiptUpload";
import { maskName } from "@/lib/mask-name";
import { recipientOf } from "@/lib/recipient";
import { GtmAwaitPayment, GtmEvent } from "@/components/GtmEvent";
import { gaItem, isPurchasable, purchaseEvent, purchaseOnceKey } from "@/lib/gtm-events";
import { feedBrand } from "@/lib/feed";
import { coverImageOf } from "@/lib/variation-input";
import { getSessionUserId } from "@/lib/account";
import { canViewOrderDetails } from "@/lib/order-access";
import { trackState } from "@/lib/orderStatus";
import { WHATSAPP_NUMBER } from "@/lib/site";
import CopyCodeButton from "@/components/CopyCodeButton";
import { bankPaymentDeadline, breakdownOf, breakdownRows, formatIstanbul, orderCode } from "@/lib/order-display";
import { smallImage } from "@/lib/img";
import { titleCaseTr } from "@/lib/display-case";
import { discountLabel } from "@/lib/order-discount-label";
import { displayTitle } from "@/lib/title-display";

export const metadata: Metadata = {
  title: "Siparişiniz Alındı",
  robots: { index: false, follow: false },
};

const waLink = (id: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Merhaba, ${orderCode(id)} kodlu siparişim hakkında bilgi almak istiyorum.`)}`;

function ClosedNote({ id, returned }: { id: string; returned: boolean }) {
  return (
    <p className="text-sm text-neutral-600 text-center">
      {returned ? "Bu siparişin iadesi tamamlanmıştır." : "Bu sipariş iptal edilmiştir."} Sorularınız için{" "}
      <a href={waLink(id)} target="_blank" rel="noopener noreferrer" className="font-semibold text-amber-800 underline underline-offset-2">WhatsApp</a> veya{" "}
      <Link href="/iletisim" className="font-semibold text-amber-800 underline underline-offset-2">iletişim sayfası</Link> üzerinden bize ulaşabilirsiniz.
    </p>
  );
}

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: { select: { name: true, password: true } }, items: { include: { variation: { include: { product: { include: { variations: { orderBy: { position: "asc" }, select: { images: true } } } } } } } } },
  });
  if (!order) notFound();

  const canSeeDetails = canViewOrderDetails({ userId: order.userId, isGuest: order.user.password === "guest_checkout", createdAt: order.createdAt }, await getSessionUserId());
  const awaitsBankReceipt = order.paymentMethod === "BANK_TRANSFER" && order.status === "PENDING_NEW";
  const closed = order.status === "CANCELLED" || order.status === "RETURNED";
  const returned = order.status === "RETURNED";

  if (!canSeeDetails) {
    const state = trackState(order);
    const statusLabel = state.kind === "special" ? state.label : state.labels[state.current];
    return (
      <main className="min-h-screen bg-neutral-50 py-12 sm:py-16 px-4">
        {order.status !== "PAYMENT_FAILED" && order.status !== "CANCELLED" && order.status !== "RETURNED" && <ClearCart orderId={order.id} createdAt={order.createdAt.toISOString()} />}
        <div data-testid="kisitli-gorunum" className="max-w-xl mx-auto bg-white rounded-3xl border border-neutral-200 p-6 sm:p-12 space-y-6 shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900 text-center">Sipariş Durumu</h1>
          <dl className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 text-xs space-y-3">
            <div>
              <dt className="text-neutral-500">Sipariş Kodu:</dt>
              <dd className="font-mono font-bold text-neutral-800 break-all">{orderCode(order.id)}</dd>
            </div>
            <div className="pt-3 border-t border-neutral-200">
              <dt className="text-neutral-500">Durum:</dt>
              <dd className="font-bold text-neutral-900 text-sm">{statusLabel}</dd>
            </div>
          </dl>
          {/* Hatırlatma e-postasındaki "Dekontumu Yükle" bağlantısı süre dolduktan sonra da çalışmalı; bu blok sipariş detayı içermez */}
          {closed && <ClosedNote id={order.id} returned={returned} />}
          {awaitsBankReceipt && !closed && (
            <div className="space-y-4">
              <BankTransferCard orderId={order.id} amount={order.totalAmount} />
              <ReceiptUpload orderId={order.id} uploaded={Boolean(order.receiptUrl)} amount={order.totalAmount} />
            </div>
          )}
          {!closed && <p className="text-sm text-neutral-600 text-center">
            Detaylar için{" "}
            <Link href="/giris" className="font-semibold text-amber-800 underline underline-offset-2">giriş yapın</Link> veya{" "}
            <Link href="/iletisim" className="font-semibold text-amber-800 underline underline-offset-2">bizimle iletişime geçin</Link>.
          </p>}
        </div>
      </main>
    );
  }

  const isPickup = order.shippingType === "BEYOGLU_MAGAZA_TESLIM";
  const awaitingPayment = order.status === "AWAITING_PAYMENT";
  const paymentFailed = order.status === "PAYMENT_FAILED";
  // Ölçüm (GTM): yalnızca ödemesi alınmış kartlı veya oluşturulmuş havale siparişi; kargo = sabit kural (mağazadan teslim 0, eşik üstü 0, aksi 100 ₺)
  const breakdown = breakdownOf(order.items, order.shippingType, order.totalAmount);
  const shippingFee = breakdown.shipping;
  // Dekont yüklenmemiş havale siparişi bu süre sonunda otomatik iptal edilir (shouldCancelUnpaidBank ile aynı koşul)
  const awaitsBankDeadline = awaitsBankReceipt && order.receiptUrl === null;
  const purchase = isPurchasable(order.status)
    ? purchaseEvent({
        id: order.id,
        total: order.totalAmount,
        shipping: shippingFee,
        paymentType: order.paymentMethod,
        coupon: order.couponCode,
        items: order.items.map((i) => gaItem({ id: i.variation.product.id, name: i.variation.product.title, price: i.unitPrice, quantity: i.quantity, category: i.variation.product.category, brand: feedBrand(), variant: i.variation.variationValue })),
      })
    : null;

  return (
    <main className="min-h-screen bg-neutral-50 py-12 sm:py-16 px-4">
      {purchase && <GtmEvent event={purchase} onceKey={purchaseOnceKey(order.id)} />}
      {awaitingPayment && <GtmAwaitPayment />}
      {!paymentFailed && order.status !== "CANCELLED" && order.status !== "RETURNED" && <ClearCart orderId={order.id} createdAt={order.createdAt.toISOString()} />}
      <div data-testid="tam-gorunum" className="max-w-xl mx-auto bg-white rounded-3xl border border-neutral-200 p-6 sm:p-12 text-center space-y-6 shadow-sm">
        <div
          aria-hidden="true"
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl font-bold ${closed ? "bg-neutral-200 text-neutral-500" : "bg-emerald-100 text-emerald-600"}`}
        >
          {closed ? "✕" : "✓"}
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900">
          {returned ? "Siparişiniz İade Edildi" : closed ? "Siparişiniz İptal Edildi" : paymentFailed ? "Ödeme Tamamlanamadı" : awaitingPayment ? "Ödemeniz Onaylanıyor" : "Teşekkürler, Siparişiniz Alındı!"}
        </h1>
        <p className="text-sm text-neutral-600">
          {closed
            ? "Bu siparişle ilgili ödeme beklenmemektedir."
            : paymentFailed
            ? "Ödemeniz alınamadı. Sepete dönerek tekrar deneyebilirsiniz."
            : awaitingPayment
            ? "Ödeme bilginiz bankadan onaylanıyor. Birkaç saniye içinde sayfayı yenileyin; onaylanınca e-posta ile bilgilendirileceksiniz."
            : <>Sayın <strong>{maskName(order.user.name)}</strong>, siparişiniz merkezimize iletildi. Onay ve gelişmeler e-posta ile bildirilecektir.</>}
        </p>

        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 text-xs text-left space-y-3">
          <div>
            <span className="text-neutral-400">Sipariş Kodu:</span>
            <p className="font-mono font-bold text-neutral-800 break-all">{orderCode(order.id)} <CopyCodeButton text={orderCode(order.id)} label="Sipariş kodu kopyalandı" /></p>
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
                    <img src={smallImage(coverImageOf(item.variation.product)!)} alt={item.variation.product.title} width={64} height={64} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  )}
                </Link>
                <span>
                  {item.quantity}x{" "}
                  <Link href={`/urun/${item.variation.product.id}`} className="hover:text-amber-700 hover:underline">
                    <strong>{displayTitle(item.variation.product.title).title}</strong>
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
          <div className="pt-3 border-t border-neutral-200 space-y-1">
            {/* E-postalarla aynı satır listesi (lib/order-display.ts) */}
            {breakdownRows(breakdown).map((r) => (
              <p key={r.label} className={`flex justify-between ${r.kind === "total" ? "font-bold text-neutral-900 text-sm pt-1" : r.kind === "discount" ? "text-emerald-700" : "text-neutral-600"}`}><span>{r.kind === "discount" ? discountLabel(order, breakdown.itemsSum, breakdown.discount) : r.label}</span><span className="whitespace-nowrap">{r.value}</span></p>
            ))}
            {awaitsBankDeadline && <p className="text-amber-800 font-semibold pt-1">Son ödeme: {formatIstanbul(bankPaymentDeadline(order.createdAt))}</p>}
          </div>
          <div className="pt-3 border-t border-neutral-200">
            <span className="text-neutral-400">Teslimat:</span>
            <p className="font-semibold text-neutral-800">
              {isPickup
                ? "📍 Mağazadan Teslim – Şişhane merkezimizden teslim alınacak"
                : "📦 Adrese Teslim – korumalı koli ile adresinize gönderilecek"}
            </p>
            <p data-testid="alici-adi" className="text-neutral-600 mt-1">Alıcı: <strong>{maskName(recipientOf(order))}</strong>{order.phone ? <> • Tel: <strong>{order.phone}</strong></> : null}</p>
            {!isPickup && order.address && (
              <p className="text-neutral-600 mt-1">{titleCaseTr(order.address)}{order.buyerCityName || order.buyerStateName ? `, ${[order.buyerCityName, order.buyerStateName].filter(Boolean).join(" / ")}` : ""}</p>
            )}
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

        {closed && <ClosedNote id={order.id} returned={returned} />}

        {order.paymentMethod === "BANK_TRANSFER" && !paymentFailed && !closed && <BankTransferCard orderId={order.id} amount={awaitsBankReceipt ? order.totalAmount : undefined} />}

        {awaitsBankReceipt && !closed && (
          <div className="text-left space-y-2">
            <p className="text-xs text-neutral-600">Havaleyi yaptıktan sonra dekontunuzu yükleyerek ödemenizin hızla onaylanmasını sağlayabilirsiniz.</p>
            <ReceiptUpload orderId={order.id} uploaded={Boolean(order.receiptUrl)} amount={order.totalAmount} />
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/giris#siparisler"
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold px-6 py-3 rounded-xl transition-colors"
          >
            Siparişlerime git
          </Link>
          <Link
            href={`/kargo-takip?code=${order.id}`}
            className="w-full sm:w-auto bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-semibold px-6 py-3 rounded-xl transition-colors"
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

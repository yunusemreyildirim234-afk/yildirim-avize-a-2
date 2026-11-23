import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getConfirmationOrder } from "@/lib/order-confirmation";
import ClearCart from "@/components/ClearCart";
import BankTransferCard from "@/components/BankTransferCard";
import ReceiptUpload from "@/components/ReceiptUpload";
import { maskName } from "@/lib/mask-name";
import { recipientOf } from "@/lib/recipient";
import { GtmEvent } from "@/components/GtmEvent";
import AwaitPaymentRefresh from "@/components/AwaitPaymentRefresh";
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
import { productPath } from "@/lib/product-url";

export const metadata: Metadata = {
  title: "Siparişiniz Alındı",
  robots: { index: false, follow: false },
};

const tl = (n: number) => `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

const waLink =(id: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Merhaba, ${orderCode(id)} kodlu siparişim hakkında bilgi almak istiyorum.`)}`;

function ClosedNote({ id, returned }: { id: string; returned: boolean }) {
  return (
    <p className="text-sm text-ink-muted text-center">
      {returned ? "Bu siparişin iadesi tamamlanmıştır." : "Bu sipariş iptal edilmiştir."} Sorularınız için{" "}
      <a href={waLink(id)} target="_blank" rel="noopener noreferrer" className="font-semibold text-bronze-ink underline underline-offset-2">WhatsApp</a> veya{" "}
      <Link href="/iletisim" className="font-semibold text-bronze-ink underline underline-offset-2">iletişim sayfası</Link> üzerinden bize ulaşabilirsiniz.
    </p>
  );
}

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getConfirmationOrder(id);
  if (!order) notFound();

  const canSeeDetails = canViewOrderDetails({ userId: order.userId, isGuest: order.user.password === "guest_checkout", createdAt: order.createdAt }, await getSessionUserId());
  const awaitsBankReceipt = order.paymentMethod === "BANK_TRANSFER" && order.status === "PENDING_NEW";
  const closed = order.status === "CANCELLED" || order.status === "RETURNED";
  const returned = order.status === "RETURNED";

  if (!canSeeDetails) {
    const state = trackState(order);
    const statusLabel = state.kind === "special" ? state.label : state.labels[state.current];
    return (
      <main className="min-h-screen bg-canvas py-12 sm:py-16 px-4">
        {order.status !== "PAYMENT_FAILED" && order.status !== "CANCELLED" && order.status !== "RETURNED" && <ClearCart orderId={order.id} createdAt={order.createdAt.toISOString()} />}
        <div data-testid="kisitli-gorunum" className="max-w-xl mx-auto bg-raised rounded-3xl border border-line p-6 sm:p-12 space-y-6 shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-ink text-center">Sipariş Durumu</h1>
          <dl className="bg-surface border border-line rounded-2xl p-5 text-xs space-y-3">
            <div>
              <dt className="text-ink-muted">Sipariş Kodu:</dt>
              <dd className="font-mono font-bold text-ink break-all">{orderCode(order.id)}</dd>
            </div>
            <div className="pt-3 border-t border-line">
              <dt className="text-ink-muted">Durum:</dt>
              <dd className="font-bold text-ink text-sm">{statusLabel}</dd>
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
          {!closed && <p className="text-sm text-ink-muted text-center">
            Detaylar için{" "}
            <Link href="/giris" className="font-semibold text-bronze-ink underline underline-offset-2">giriş yapın</Link> veya{" "}
            <Link href="/iletisim" className="font-semibold text-bronze-ink underline underline-offset-2">bizimle iletişime geçin</Link>.
          </p>}
        </div>
      </main>
    );
  }

  const isPickup = order.shippingType === "BEYOGLU_MAGAZA_TESLIM";
  const awaitingPayment = order.status === "AWAITING_PAYMENT";
  const paymentFailed = order.status === "PAYMENT_FAILED";
  // Ölçüm (GTM): yalnızca ödemesi alınmış kartlı veya oluşturulmuş havale siparişi; kargo = sabit kural (mağazadan teslim 0, eşik üstü 0, aksi SHIPPING_COST)
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
    <main className="min-h-screen bg-canvas py-12 sm:py-16 px-4">
      {purchase && <GtmEvent event={purchase} onceKey={purchaseOnceKey(order.id)} />}
      {awaitingPayment && <AwaitPaymentRefresh />}
      {!paymentFailed && order.status !== "CANCELLED" && order.status !== "RETURNED" && <ClearCart orderId={order.id} createdAt={order.createdAt.toISOString()} />}
      <div data-testid="tam-gorunum" className="max-w-xl mx-auto bg-raised rounded-3xl border border-line p-6 sm:p-12 text-center space-y-6 shadow-sm">
        <div
          aria-hidden="true"
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl font-bold ${closed ? "bg-line text-ink-muted" : "bg-emerald-100 text-emerald-600"}`}
        >
          {closed ? "✕" : "✓"}
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-ink">
          {returned ? "Siparişiniz İade Edildi" : closed ? "Siparişiniz İptal Edildi" : paymentFailed ? "Ödeme Tamamlanamadı" : awaitingPayment ? "Ödemeniz Onaylanıyor" : "Teşekkürler, Siparişiniz Alındı!"}
        </h1>
        <p className="text-sm text-ink-muted">
          {closed
            ? "Bu siparişle ilgili ödeme beklenmemektedir."
            : paymentFailed
            ? "Ödemeniz alınamadı. Sepete dönerek tekrar deneyebilirsiniz."
            : awaitingPayment
            ? "Ödeme bilginiz bankadan onaylanıyor. Birkaç saniye içinde sayfayı yenileyin; onaylanınca e-posta ile bilgilendirileceksiniz."
            : <>Sayın <strong>{maskName(order.user.name)}</strong>, siparişiniz merkezimize iletildi. Onay ve gelişmeler e-posta ile bildirilecektir.</>}
        </p>

        <div className="bg-surface border border-line rounded-2xl p-5 text-xs text-left space-y-3">
          <div>
            <span className="text-ink-subtle">Sipariş Kodu:</span>
            <p className="font-mono font-bold text-ink break-all">{orderCode(order.id)} <CopyCodeButton text={orderCode(order.id)} label="Sipariş kodu kopyalandı" /></p>
          </div>
          <ul className="pt-3 border-t border-line space-y-3">
            {order.items.map((item) => (
              <li key={item.id} className="text-ink-muted flex items-center gap-3">
                <Link
                  href={productPath(item.variation.product)}
                  aria-label={`${item.variation.product.title} ürün sayfası`}
                  className="w-[72px] h-[72px] rounded-xl bg-surface overflow-hidden shrink-0 border border-line flex items-center justify-center"
                >
                  {coverImageOf(item.variation.product) && (
                    <img src={smallImage(coverImageOf(item.variation.product)!)} alt={item.variation.product.title} width={64} height={64} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  )}
                </Link>
                <span>
                  {item.quantity}x{" "}
                  <Link href={productPath(item.variation.product)} className="hover:text-bronze-ink hover:underline">
                    <strong>{displayTitle(item.variation.product.title).title}</strong>
                  </Link>{" "}
                  – {item.variation.variationValue}
                  <span className="block text-ink-muted mt-0.5">
                    {item.quantity} × {tl(item.unitPrice)} = <strong className="text-ink">{tl(item.unitPrice * item.quantity)}</strong>
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {order.orderNote && (
            <div className="pt-3 border-t border-line">
              <span className="text-ink-subtle">Sipariş Notunuz:</span>
              <p className="font-medium text-ink whitespace-pre-line">{order.orderNote}</p>
            </div>
          )}
          <div className="pt-3 border-t border-line space-y-1">
            {/* E-postalarla aynı satır listesi (lib/order-display.ts) */}
            {breakdownRows(breakdown).map((r) => (
              <p key={r.label} className={`flex justify-between ${r.kind === "total" ? "font-bold text-ink text-sm pt-1" : r.kind === "discount" ? "text-emerald-700" : "text-ink-muted"}`}><span>{r.kind === "discount" ? discountLabel(order, breakdown.itemsSum, breakdown.discount) : r.label}</span><span className="whitespace-nowrap">{r.value}</span></p>
            ))}
            {awaitsBankDeadline && <p className="text-bronze-ink font-semibold pt-1">Son ödeme: {formatIstanbul(bankPaymentDeadline(order.createdAt))}</p>}
          </div>
          <div className="pt-3 border-t border-line">
            <span className="text-ink-subtle">Teslimat:</span>
            <p className="font-semibold text-ink">
              {isPickup
                ? "📍 Mağazadan Teslim – Şişhane merkezimizden teslim alınacak"
                : "📦 Adrese Teslim – korumalı koli ile adresinize gönderilecek"}
            </p>
            <p data-testid="alici-adi" className="text-ink-muted mt-1">Alıcı: <strong>{maskName(recipientOf(order))}</strong>{order.phone ? <> • Tel: <strong>{order.phone}</strong></> : null}</p>
            {!isPickup && order.address && (
              <p className="text-ink-muted mt-1">{titleCaseTr(order.address)}{order.buyerCityName || order.buyerStateName ? `, ${[order.buyerCityName, order.buyerStateName].filter(Boolean).join(" / ")}` : ""}</p>
            )}
            {order.kargonomiShipmentId && (
              <p className="text-ink-muted mt-1">
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
            <p className="text-xs text-ink-muted">Havaleyi yaptıktan sonra dekontunuzu yükleyerek ödemenizin hızla onaylanmasını sağlayabilirsiniz.</p>
            <ReceiptUpload orderId={order.id} uploaded={Boolean(order.receiptUrl)} amount={order.totalAmount} />
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/giris#siparisler"
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-ink text-xs font-bold px-6 py-3 rounded-xl transition-colors"
          >
            Siparişlerime git
          </Link>
          <Link
            href={`/kargo-takip?code=${order.id}`}
            className="w-full sm:w-auto bg-surface hover:bg-line text-ink text-xs font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            🚚 Kargo & Sipariş Takibi
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto bg-ink hover:bg-bronze-ink text-canvas text-xs font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Alışverişe Devam Et →
          </Link>
        </div>
      </div>
    </main>
  );
}

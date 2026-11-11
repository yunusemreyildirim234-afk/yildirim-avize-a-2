import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Package, Phone, Receipt, StickyNote } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin-guard";
import { cleanGuestEmail } from "@/lib/guest-email";
import { ADDRESS_LINE } from "@/lib/site";
import { istanbulDateTimeParts } from "@/lib/format-date";
import { orderItemProductView } from "@/lib/order-item-product";
import { bankPaymentDeadline, breakdownOf, breakdownRows, deliveryAddressText, formatIstanbul, formatTl, orderCode } from "@/lib/order-display";
import { buildFis, paymentMethodLabel } from "@/lib/admin-order-detail";
import { recipientDiffers, recipientLabel } from "@/lib/recipient";
import AdminPrintButton from "@/components/AdminPrintButton";
import OrderStatusSelector from "@/components/OrderStatusSelector";
import AdminKargonomiOrderActions from "@/components/AdminKargonomiOrderActions";
import AdminOrderRequest from "@/components/AdminOrderRequest";
import AdminReceiptActions from "@/components/AdminReceiptActions";
import { smallImage } from "@/lib/img";

export const dynamic = "force-dynamic";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const card = "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm";
const h = "text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3";

// Yönetici oturumu proxy.ts'te (/admin/:path*) denetlenir; ayrıca sayfa başında ikinci kez doğrulanır (requireAdminPage).
export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!ID_RE.test(id)) notFound();
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      items: { include: { variation: { omit: { syncSnapshot: true, syncStock: true }, include: { product: { select: { id: true, title: true, imageUrl: true, images: true } } } } } },
    },
  });
  if (!order) notFound();

  const isPickup = order.shippingType === "BEYOGLU_MAGAZA_TESLIM";
  const dt = istanbulDateTimeParts(order.createdAt);
  const rows = breakdownRows(breakdownOf(order.items, order.shippingType, order.totalAmount));
  const fis = buildFis({ ...order, items: order.items.map((i) => ({ quantity: i.quantity, variationValue: i.variation?.variationValue, title: orderItemProductView(i.variation?.product).title })) }, ADDRESS_LINE);
  const fisTime = dt ? `${dt.date} ${dt.time}` : "-";
  const awaitsReceipt = order.paymentMethod === "BANK_TRANSFER" && order.status === "PENDING_NEW";

  return (
    <main className="min-h-screen bg-neutral-100 py-8 px-4 sm:px-6 lg:px-8 print:min-h-0 print:bg-white print:p-0">
      {/* Hazırlık fişi: yalnızca yazdırmada görünür; fiyat/indirim/toplam yok (depo ve kargo çalışanı için) */}
      <section data-testid="hazirlik-fisi" aria-label="Hazırlık fişi" className="hidden print:block text-black">
        <h1 className="text-xl font-bold">Hazırlık Fişi — {fis.code}</h1>
        <p className="text-sm">Tarih: {fisTime}</p>
        {fis.recipient && <p className="mt-3 text-sm"><strong>Alıcı:</strong> {fis.recipient}</p>}
        <p className="mt-3 text-sm"><strong>{fis.isPickup ? "Mağazadan teslim" : "Teslimat adresi"}:</strong> {fis.address}</p>
        <p className="text-sm"><strong>Telefon:</strong> {fis.phone}</p>
        <p className="text-sm"><strong>Ödeme yöntemi:</strong> {fis.payment}</p>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black text-left"><th className="py-1">Ürün</th><th className="py-1">Varyasyon</th><th className="py-1 text-right">Adet</th></tr>
          </thead>
          <tbody>
            {fis.items.map((i, idx) => (
              <tr key={idx} className="border-b border-neutral-400"><td className="py-1 pr-2">{i.title}</td><td className="py-1 pr-2">{i.variation}</td><td className="py-1 text-right font-bold">{i.quantity}</td></tr>
            ))}
          </tbody>
        </table>
        {fis.note && <p className="mt-4 whitespace-pre-line border border-black p-2 text-sm"><strong>Sipariş notu:</strong> {fis.note}</p>}
      </section>
      <div className="mx-auto max-w-5xl space-y-5 print:hidden">
        <Link href="/admin?durum=tumu#siparisler" className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-amber-700">
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" /> Sipariş listesine dön
        </Link>

        <div className={`${card} flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between`}>
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Sipariş Kodu</span>
            <h1 className="font-mono text-2xl font-bold text-neutral-900">{orderCode(order.id)}</h1>
            <p className="mt-1 break-all font-mono text-[11px] text-neutral-500">Tam kimlik: {order.id}</p>
            <p className="mt-1 text-xs text-neutral-600">{dt ? `${dt.date} ${dt.time}` : "—"}</p>
          </div>
          <div className="flex flex-col gap-2 sm:w-64">
            <AdminPrintButton label="Hazırlık fişi yazdır" />
            {awaitsReceipt && <div className="mb-2"><AdminReceiptActions orderId={order.id} hasReceipt={Boolean(order.receiptUrl)} senderName={order.receiptSenderName} /></div>}
            <OrderStatusSelector orderId={order.id} initialStatus={order.status} shippingType={order.shippingType} />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <section className={card} aria-labelledby="musteri">
            <h2 id="musteri" className={h}>Müşteri</h2>
            <p className="font-bold text-neutral-900">{order.user.name}</p>
            {recipientDiffers(order) && (
              <p data-testid="alici-adi" className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-950">{recipientLabel(order)}</p>
            )}
            <p className="break-all text-xs text-neutral-600">{cleanGuestEmail(order.user.email)}</p>
            {order.phone && (
              <p className="mt-1 flex items-center gap-1 font-mono text-xs text-neutral-700">
                <Phone aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> {order.phone}
              </p>
            )}
            <p className="mt-2 flex items-start gap-1 text-[11px] text-neutral-500">
              <Receipt aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                {order.invoiceType === "CORPORATE"
                  ? `Kurumsal: ${order.companyTitle ?? "-"} • VD: ${order.taxOffice ?? "-"} • VKN: ${order.taxNumber ?? "-"}`
                  : `Bireysel${order.taxNumber ? ` • T.C. ${order.taxNumber}` : ""}`}
              </span>
            </p>
          </section>

          <section className={card} aria-labelledby="teslimat">
            <h2 id="teslimat" className={h}>Teslimat</h2>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isPickup ? "bg-amber-100 text-amber-900" : "bg-blue-100 text-blue-900"}`}>
              {isPickup ? <MapPin aria-hidden="true" className="h-3.5 w-3.5" /> : <Package aria-hidden="true" className="h-3.5 w-3.5" />} {isPickup ? "Mağazadan Teslim" : "Adrese Teslim"}
            </span>
            <p className="mt-2 text-sm text-neutral-800">{deliveryAddressText(order, ADDRESS_LINE)}</p>
            {order.orderNote && (
              <p className="mt-3 whitespace-pre-line rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                <StickyNote aria-hidden="true" className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
                <strong>Sipariş Notu:</strong> {order.orderNote}
              </p>
            )}
          </section>
        </div>

        <section className={card} aria-labelledby="urunler">
          <h2 id="urunler" className={h}>Ürünler</h2>
          <ul className="divide-y divide-neutral-100">
            {order.items.map((item) => {
              const p = orderItemProductView(item.variation?.product);
              const thumb = p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={smallImage(p.image)} alt={p.title ?? "Ürün"} loading="lazy" width={56} height={56} className="h-14 w-14 shrink-0 rounded bg-neutral-100 object-cover" />
              ) : (
                <span aria-hidden="true" className="h-14 w-14 shrink-0 rounded bg-neutral-200" />
              );
              return (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  {p.href ? <a href={p.href} target="_blank" rel="noopener" className="shrink-0">{thumb}</a> : thumb}
                  <div className="min-w-0 flex-1">
                    {p.title && (p.href ? <a href={p.href} target="_blank" rel="noopener" className="block text-sm font-bold text-neutral-900 hover:underline">{p.title}</a> : <span className="block text-sm font-bold text-neutral-900">{p.title}</span>)}
                    <span className="text-xs text-neutral-600">{item.variation?.variationValue ?? "-"}</span>
                  </div>
                  <div className="shrink-0 text-right text-xs text-neutral-700">
                    <div className="font-semibold">{item.quantity} × {formatTl(item.unitPrice)}</div>
                    <div className="text-neutral-500">{formatTl(item.quantity * item.unitPrice)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <section className={card} aria-labelledby="tutar">
            <h2 id="tutar" className={h}>Tutar Dökümü</h2>
            <dl className="space-y-1 text-sm">
              {rows.map((r) => (
                <div key={r.label} className={`flex justify-between gap-3 ${r.kind === "total" ? "border-t border-neutral-200 pt-2 font-bold text-neutral-900" : r.kind === "discount" ? "text-emerald-700" : "text-neutral-700"}`}>
                  <dt>{r.label}</dt>
                  <dd className="whitespace-nowrap">{r.value}</dd>
                </div>
              ))}
            </dl>
            {order.couponCode && <p className="mt-3 text-xs text-neutral-600">Kupon: <span className="font-mono font-semibold">{order.couponCode}</span></p>}
          </section>

          <section className={card} aria-labelledby="odeme">
            <h2 id="odeme" className={h}>Ödeme</h2>
            <p className="text-sm font-semibold text-neutral-900">{paymentMethodLabel(order.paymentMethod)}</p>
            {order.status === "AWAITING_PAYMENT" && <p className="mt-1 text-xs text-yellow-800">Ödeme tamamlanmadı (sipariş denemesi).</p>}
            {order.status === "PAYMENT_FAILED" && <p className="mt-1 text-xs text-red-700">Ödeme başarısız.</p>}
            {order.paymentMethod === "BANK_TRANSFER" && (
              <div className="mt-2 space-y-1 text-xs text-neutral-700">
                <p>
                  Dekont:{" "}
                  {order.receiptUrl ? (
                    <a href={order.receiptUrl} target="_blank" rel="noopener" className="font-semibold text-amber-700 underline">Dekontu aç</a>
                  ) : (
                    "henüz yüklenmedi"
                  )}
                </p>
                {order.receiptSenderName && <p>Gönderici: {order.receiptSenderName}</p>}
                {awaitsReceipt && <p>Son ödeme zamanı: {formatIstanbul(bankPaymentDeadline(order.createdAt))}</p>}
              </div>
            )}
          </section>
        </div>

        <section className={card} aria-labelledby="kargo">
          <h2 id="kargo" className={h}>Kargo (Kargonomi)</h2>
          <AdminKargonomiOrderActions
            order={{
              id: order.id,
              status: order.status,
              shippingType: order.shippingType,
              kargonomiShipmentId: order.kargonomiShipmentId,
              kargonomiStatusLabel: order.kargonomiStatusLabel,
              shippingTrackingCode: order.shippingTrackingCode,
              shippingBarcode: order.shippingBarcode,
              shippingProviderName: order.shippingProviderName,
              barcodeUrl: order.barcodeUrl,
              labelCreated: order.labelCreated,
            }}
          />
        </section>

        {order.cancelReturnType && (
          <section className={card} aria-labelledby="talep">
            <h2 id="talep" className={h}>İptal / İade Talebi</h2>
            <AdminOrderRequest orderId={order.id} type={order.cancelReturnType} status={order.cancelReturnStatus} reason={order.cancelReturnReason} />
          </section>
        )}
      </div>
    </main>
  );
}

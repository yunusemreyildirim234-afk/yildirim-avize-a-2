import { carrierDisplayName, carrierTrackingLink } from "@/lib/carrier-links";
import { orderCode } from "@/lib/order-display";
import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import OrderTracker from "@/components/OrderTracker";
import { maskName } from "@/lib/mask-name";
import { recipientOf } from "@/lib/recipient";
import Link from "next/link";
import { rateLimit } from "@/lib/rate-limit";
import { isShortOrderCode } from "@/lib/order-lookup";
import { trackOrder } from "./actions";
import TrackForm from "@/components/TrackForm";

export const metadata: Metadata = {
  title: "Kargo & Sipariş Takibi",
  description: "Yıldırım Avize sipariş ve kargo durumunuzu sipariş veya takip koduyla sorgulayın.",
  alternates: { canonical: "/kargo-takip" },
};

// Sipariş sorgusu ayrı bir bileşendir: sayfa kabuğu (tek <main>, h1, form) hemen gelir; yalnızca sonuç alanı Suspense iskeletiyle bekler.
async function OrderResult({ code, verify }: { code: string; verify?: string }) {
  const rl = rateLimit(new Request("http://localhost/kargo-takip", { headers: await headers() }), "kargo-takip", 20, 10 * 60_000);
  if (rl.limited) {
    return (
      <p role="alert" className="text-sm text-center text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">
        Kısa sürede çok fazla sorgu yaptınız. Lütfen birkaç dakika sonra tekrar deneyin.
      </p>
    );
  }

  const found = await prisma.order.findFirst({
    where: { OR: [{ id: code }, { shippingTrackingCode: code }, { shippingBarcode: code }] },
    // Yalnızca sayfanın ve takip çubuğunun kullandığı alanlar (adres, telefon, fatura bilgileri istemciye gitmez)
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      shippingType: true,
      kargonomiStatus: true,
      kargonomiStatusLabel: true,
      cancelReturnType: true,
      cancelReturnStatus: true,
      createdAt: true,
      updatedAt: true,
      kargonomiShipmentId: true,
      shippingProviderName: true,
      shippingProviderId: true,
      shippingTrackingCode: true,
      shippingBarcode: true,
      recipientName: true,
      user: { select: { name: true } },
    },
  });

  if (!found) {
    const msg =
      verify === "sinir"
        ? "Kısa sürede çok fazla deneme yaptınız. Lütfen birkaç dakika sonra tekrar deneyin."
        : verify === "hata"
        ? "Bu kod ve e-posta adresiyle eşleşen bir sipariş bulunamadı. Siparişte kullandığınız e-posta adresini yazdığınızdan emin olun."
        : isShortOrderCode(code)
        ? "Bu kodla eşleşen bir sipariş bulunamadı. 8 haneli sipariş koduyla sorgulamak için e-posta adresinizi de yazın."
        : "Bu kodla eşleşen bir sipariş bulunamadı.";
    return (
      <p role="alert" className="text-sm text-center text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
        {msg}
      </p>
    );
  }

  // Takip kodu/barkod koli etiketinde yazar: sipariş numarası yalnızca onu zaten bilen sorguda gösterilir
  const { id, paymentMethod, ...order } = found;
  const awaitsBankPayment = paymentMethod === "BANK_TRANSFER" && order.status === "PENDING_NEW";

  return (
    <div className="bg-raised rounded-2xl border border-line p-6 text-xs space-y-3 shadow-sm">
      {id === code && (
        <div className="pb-3 border-b border-line">
          <span className="text-ink-subtle">Sipariş Kodu</span>
          <p className="font-mono font-bold text-ink break-all">{orderCode(id)}</p>
        </div>
      )}
      <div>
        <span className="text-ink-subtle">Alıcı</span>
        <p className="font-semibold text-ink">{maskName(recipientOf(order))}</p>
      </div>
      <div className="pt-3 border-t border-line">
        <span className="text-ink-subtle block mb-2">Sipariş Durumu</span>
        {awaitsBankPayment ? (
          <div>
            <p className="text-sm font-bold text-amber-800">Ödeme bekleniyor</p>
            <p className="text-ink-muted mt-1">Havale/EFT ödemeniz onaylandığında siparişiniz hazırlanmaya başlayacaktır.</p>
            {/* Sipariş numarasını zaten bilen sorgu için: erişim kuralları onay sayfasında uygulanır */}
            {id === code && (
              <Link href={`/siparis-onay/${id}`} className="inline-block mt-2 font-semibold text-bronze-ink underline underline-offset-2">
                Havale bilgileri ve dekont yükleme →
              </Link>
            )}
          </div>
        ) : (
          <OrderTracker order={order} />
        )}
      </div>
      {order.kargonomiShipmentId && (
        <div className="pt-3 border-t border-line space-y-1">
          <span className="text-ink-subtle">Kargo Firması</span>
          <p className="text-sm font-bold text-orange-700">{carrierDisplayName(order.shippingProviderName)}</p>
          <p className="font-semibold text-ink">
            {order.shippingTrackingCode || order.shippingBarcode ? order.kargonomiStatusLabel || "Kargo kaydı oluşturuldu" : "Kargo bilgileriniz hazırlanıyor"}
          </p>
          {order.shippingTrackingCode && (
            <p className="text-ink-muted">
              Takip kodu: <span className="font-mono">{order.shippingTrackingCode}</span>
            </p>
          )}
          {order.shippingBarcode && (
            <p className="text-ink-muted">
              Barkod: <span className="font-mono">{order.shippingBarcode}</span>
            </p>
          )}
          {(() => {
            const t = carrierTrackingLink({ providerId: order.shippingProviderId, providerName: order.shippingProviderName, code: order.shippingTrackingCode || order.shippingBarcode });
            return t.href ? (
              <a
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                {t.label}
              </a>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

export default async function TrackingPage({ searchParams }: { searchParams: Promise<{ code?: string; dogrulama?: string }> }) {
  const sp = await searchParams;
  const code = sp.code?.trim().slice(0, 100);
  const verify = sp.dogrulama === "hata" || sp.dogrulama === "sinir" ? sp.dogrulama : undefined;

  return (
    <main className="min-h-screen bg-canvas py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <span className="text-xs uppercase tracking-widest text-bronze-ink font-semibold">Takip</span>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-ink">Kargo & Sipariş Takibi</h1>
          <p className="text-sm text-ink-muted">
            Kargoya verildiğinde e-postayla gelen takip kodunu yazın ya da 8 haneli sipariş kodunuzla birlikte siparişteki e-posta adresini girin; üyeyseniz{" "}
            <Link href="/giris#siparisler" className="font-semibold text-bronze-ink underline underline-offset-2">Siparişlerim</Link>
            &apos;den de takip edebilirsiniz.
          </p>
        </div>

        <TrackForm action={trackOrder} defaultCode={code} />

        {code && (
          <Suspense
            fallback={
              <div role="status" aria-busy="true" className="h-40 rounded-2xl bg-line/70 motion-safe:animate-pulse">
                <span className="sr-only">Sipariş sorgulanıyor…</span>
              </div>
            }
          >
            <OrderResult code={code} verify={verify} />
          </Suspense>
        )}
      </div>
    </main>
  );
}

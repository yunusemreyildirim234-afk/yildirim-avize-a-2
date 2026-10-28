import type { Metadata } from "next";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Kargo & Sipariş Takibi",
  description: "Yıldırım Avize sipariş ve Kargonomi kargo durumunuzu sipariş veya takip koduyla sorgulayın.",
  alternates: { canonical: "/kargo-takip" },
};

const ORDER_STATUS: Record<string, string> = {
  PENDING: "⏳ Hazırlanıyor",
  READY_FOR_PICKUP: "📍 Mağazada teslime hazır",
  SHIPPED: "📦 Kargoya verildi",
  DELIVERED: "✓ Teslim edildi",
  CANCELLED: "İptal edildi",
};

export default async function TrackingPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = (await searchParams).code?.trim();

  const order = code
    ? await prisma.order.findFirst({
        where: { OR: [{ id: code }, { shippingTrackingCode: code }, { shippingBarcode: code }] },
      })
    : null;

  return (
    <main className="min-h-screen bg-neutral-50 py-12 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <span className="text-xs uppercase tracking-widest text-amber-600 font-semibold">Takip</span>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900">Kargo & Sipariş Takibi</h1>
        </div>

        <form method="get" className="flex flex-col sm:flex-row gap-2">
          <label htmlFor="code" className="sr-only">
            Sipariş veya takip kodu
          </label>
          <input
            id="code"
            name="code"
            defaultValue={code}
            required
            placeholder="Sipariş veya takip kodunuz"
            className="flex-1 border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            className="bg-neutral-900 hover:bg-amber-600 text-white text-xs font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Sorgula
          </button>
        </form>

        {code && !order && (
          <p role="alert" className="text-sm text-center text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
            Bu kodla eşleşen bir sipariş bulunamadı.
          </p>
        )}

        {order && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 text-xs space-y-3 shadow-sm">
            <div>
              <span className="text-neutral-400">Sipariş No</span>
              <p className="font-mono font-bold text-neutral-800 break-all">{order.id}</p>
            </div>
            <div className="pt-3 border-t border-neutral-100">
              <span className="text-neutral-400">Sipariş Durumu</span>
              <p className="font-semibold text-neutral-900 text-sm">{ORDER_STATUS[order.status] ?? order.status}</p>
            </div>
            {order.kargonomiShipmentId && (
              <div className="pt-3 border-t border-neutral-100 space-y-1">
                <span className="text-neutral-400">Kargo (Kargonomi #{order.kargonomiShipmentId})</span>
                <p className="font-semibold text-neutral-900">{order.kargonomiStatusLabel || "Taslak"}</p>
                {order.shippingTrackingCode && (
                  <p className="text-neutral-600">
                    Takip kodu: <span className="font-mono">{order.shippingTrackingCode}</span>
                  </p>
                )}
                {order.shippingBarcode && (
                  <p className="text-neutral-600">
                    Barkod: <span className="font-mono">{order.shippingBarcode}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

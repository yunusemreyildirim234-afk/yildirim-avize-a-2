import { cleanGuestEmail } from "@/lib/guest-email";
import Link from "next/link";
import { prisma } from "@/lib/db";
import AdminAddProduct from "@/components/AdminAddProduct";
import AdminProductList from "@/components/AdminProductList";
import OrderStatusSelector from "@/components/OrderStatusSelector";
import AdminKargonomiHeader from "@/components/AdminKargonomiHeader";
import AdminTrendyolSync from "@/components/AdminTrendyolSync";
import AdminKargonomiOrderActions from "@/components/AdminKargonomiOrderActions";
import AdminMessages from "@/components/AdminMessages";
import AdminCoupons from "@/components/AdminCoupons";
import AdminLiveAlerts from "@/components/AdminLiveAlerts";
import AdminSection from "@/components/AdminSection";
import AdminReceiptActions from "@/components/AdminReceiptActions";
import AdminOrderRequest from "@/components/AdminOrderRequest";
import AdminReviews from "@/components/AdminReviews";
import AdminCompany from "@/components/AdminCompany";
import AdminOrderFilters from "@/components/AdminOrderFilters";
import AdminInvoice from "@/components/AdminInvoice";
import AdminShipmentSync from "@/components/AdminShipmentSync";
import AdminDeleteButton from "@/components/AdminDeleteButton";
import AdminActivity from "@/components/AdminActivity";
import { getActivity } from "@/lib/activity";
import { getCompanyInfo } from "@/lib/company";
import { ORDER_GROUPS, isCountedOrder, matchesGroups, parseGroupParam, type OrderGroupKey } from "@/lib/orderStatus";
import { getInvoiceMeta } from "@/lib/invoice";

export const dynamic = "force-dynamic";

async function getAdminData() {
  const [orders, products, messages, coupons, customers, reviews, company] = await Promise.all([
    prisma.order.findMany({
      include: {
        user: true,
        items: {
          include: {
            variation: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      include: {
        variations: {
          orderBy: { id: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contactMessage.findMany({
      include: { product: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.coupon.findMany({
      include: { product: { select: { title: true, modelCode: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: "USER", password: { not: "guest_checkout" } },
      select: { name: true, email: true },
      orderBy: { email: "asc" },
    }),
    prisma.review.findMany({
      include: { user: { select: { name: true, email: true } }, product: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    getCompanyInfo(),
  ]);

  return { orders, products, messages, coupons, customers, reviews, company };
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ durum?: string }> }) {
  const selectedGroups = parseGroupParam((await searchParams).durum);
  const { orders, products, messages, coupons, customers, reviews, company } = await getAdminData();
  const activity = await getActivity();
  const pendingReviews = reviews.filter((r) => r.status === "PENDING").length;
  const sortedReviews = [...reviews].sort(
    (a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING") || b.createdAt.getTime() - a.createdAt.getTime()
  );
  // Bekleyenler üstte, kendi içinde en yeni önce
  const sortedMessages = [...messages].sort(
    (a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING") || b.createdAt.getTime() - a.createdAt.getTime()
  );

  // Sayaçlar: yalnızca ödemesi alınmış, iptal/iade edilmemiş siparişler "geçerli" sayılır (lib/orderStatus.ts)
  const countedOrders = orders.filter((o) => isCountedOrder(o.status));
  const attempts = orders.filter((o) => o.status === "AWAITING_PAYMENT");
  const groupCounts = Object.fromEntries(ORDER_GROUPS.map((g) => [g.key, orders.filter((o) => g.test(o)).length])) as Record<OrderGroupKey, number>;
  const pendingMessages = messages.filter((m) => m.status === "PENDING").length;
  const totalRevenue = countedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const beyogluOrders = countedOrders.filter((o) => o.shippingType === "BEYOGLU_MAGAZA_TESLIM");
  const beyogluDelivered = beyogluOrders.filter((o) => o.status === "DELIVERED").length;
  // Açık Kargonomi gönderisi: gönderisi oluşturulmuş ve henüz teslim edilmemiş/iptal edilmemiş sipariş
  const openShipmentCount = orders.filter((o) => Boolean(o.kargonomiShipmentId) && ["PENDING", "SHIPPED"].includes(o.status)).length;

  // Liste: seçili durum gruplarına göre süzülür
  const visibleOrders = orders.filter((o) => matchesGroups(o, selectedGroups));

  // Fatura bilgileri ana sipariş sorgusundan ayrı okunur; tablo yoksa panelin geri kalanı çalışır
  const deliveredIds = visibleOrders.filter((o) => o.status === "DELIVERED").map((o) => o.id);
  const invoices = await getInvoiceMeta(deliveredIds);

  return (
    <main className="min-h-screen bg-neutral-100 py-10 px-4 sm:px-6 lg:px-8">
      <AdminLiveAlerts />
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Üst Başlık */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-6">
          <div>
            <span className="text-xs uppercase tracking-widest text-amber-600 font-bold">
              Yıldırım Avize Yönetim Merkezi
            </span>
            <h1 className="text-3xl font-serif font-bold text-neutral-900 mt-1">
              Operasyon, Kargonomi & Envanter Paneli
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/kargo-takip"
              className="text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-900 px-4 py-2.5 rounded-xl hover:bg-amber-100 transition-colors w-fit"
            >
              🚚 Kargo Takip Sayfası
            </Link>
            <Link
              href="/"
              className="text-xs font-semibold bg-white border border-neutral-300 text-neutral-700 px-4 py-2.5 rounded-xl hover:bg-neutral-50 transition-colors w-fit"
            >
              ← Mağaza Vitrinine Dön
            </Link>
          </div>
        </div>

        {/* Kargonomi API v1 Canlı Kontrol & Bakiye Barı */}
        <AdminKargonomiHeader />

        {/* Trendyol ürün senkronizasyonu */}
        <AdminTrendyolSync />

        {/* 1. Özet İstatistik Kartları */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
            <span className="text-xs text-neutral-500 font-medium block">Toplam Ciro</span>
            <span className="text-2xl font-bold text-neutral-900 mt-1 block">
              {totalRevenue.toLocaleString("tr-TR")} ₺
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
            <span className="text-xs text-neutral-500 font-medium block">Geçerli Sipariş</span>
            <span className="text-2xl font-bold text-neutral-900 mt-1 block">
              {countedOrders.length} adet
            </span>
            <span className="text-[11px] text-neutral-400 mt-1 block">
              Toplam kayıt: {orders.length} (iptal, iade ve ödemesi tamamlanmayanlar hariç)
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-sm">
            <span className="text-xs text-emerald-800 font-medium block">
              Açık Kargonomi Gönderileri
            </span>
            <span className="text-2xl font-bold text-emerald-900 mt-1 block">
              {openShipmentCount} gönderi
            </span>
            <span className="text-[11px] text-emerald-800/70 mt-1 block">Teslim edilmemiş, iptal/iade olmayan</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-sm">
            <span className="text-xs text-amber-800 font-medium block">
              Beyoğlu Mağaza Siparişleri
            </span>
            <span className="text-2xl font-bold text-amber-900 mt-1 block">
              {beyogluOrders.length} sipariş • {beyogluDelivered} teslim edilen
            </span>
            <span className="text-[11px] text-amber-800/70 mt-1 block">
              İptal, iade ve ödemesi tamamlanmayanlar hariç • Katalog: {products.length} model
            </span>
          </div>
        </div>

        {/* 2. Hızlı Avize Ekleme Modülü */}
        <AdminAddProduct />

        {/* Promosyon Kodları Yönetimi */}
        <AdminCoupons
          coupons={coupons.map((c) => ({
            id: c.id,
            code: c.code,
            discountPercent: c.discountPercent,
            maxUses: c.maxUses,
            usedCount: c.usedCount,
            userEmail: c.userEmail,
            productTitle: c.product?.title ?? null,
            productModelCode: c.product?.modelCode ?? null,
            active: c.active,
            createdAt: c.createdAt.toISOString(),
          }))}
          customers={customers}
          products={products.map((p) => ({ id: p.id, title: p.title, modelCode: p.modelCode }))}
        />

        {/* 3. Canlı Avize Kataloğu & Stok Yönetimi */}
        <AdminProductList products={products} />

        {/* 4. Canlı Siparişler & Kargonomi Operasyon Tablosu */}
        <AdminSection
          id="siparisler"
          title="Gelen Siparişler, Durum & Kargonomi Yönetimi"
          description="Kargonomi gönderisi oluşturabilir, fiyat tekliflerini onaylayabilir ve PDF barkod çıktısı alabilirsiniz."
          badges={[
            { label: `${groupCounts.yeni} yeni gelen`, tone: groupCounts.yeni > 0 ? "amber" : "neutral" },
            ...(groupCounts.talep > 0 ? [{ label: `${groupCounts.talep} talep bekliyor`, tone: "red" as const }] : []),
            ...(attempts.length > 0 ? [{ label: `${attempts.length} deneme`, tone: "neutral" as const }] : []),
          ]}
        >
          <AdminOrderFilters selected={selectedGroups} counts={groupCounts} total={orders.length} />
          <div className="flex flex-wrap items-center justify-end gap-3 px-6 pt-4">
            {visibleOrders.length > 0 && (
              <AdminDeleteButton
                endpoint="/api/admin/orders"
                ids={visibleOrders.map((o) => o.id)}
                label={`Listelenen ${visibleOrders.length} siparişi sil`}
                confirmText={`Listelenen ${visibleOrders.length} sipariş ve bağlı fatura/dekont kayıtları silinecek.`}
              />
            )}
            <AdminShipmentSync />
          </div>
          {orders.length === 0 ? (
            <div className="p-12 text-center text-neutral-400 text-xs">
              Henüz verilmiş bir sipariş bulunmuyor.
            </div>
          ) : visibleOrders.length === 0 ? (
            <div className="p-12 text-center text-neutral-400 text-xs">
              Seçili durum filtrelerine uyan sipariş yok. Yukarıdan başka bir filtre seçebilir veya &quot;Tümü&quot;nü açabilirsiniz.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-700">
                <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wider text-[10px] border-b border-neutral-200">
                  <tr>
                    <th className="p-4">Sipariş ID & Tarih</th>
                    <th className="p-4">Müşteri & Adres</th>
                    <th className="p-4">Alınan Avize</th>
                    <th className="p-4">Teslimat & Tutar</th>
                    <th className="p-4">Kargonomi API İşlemleri</th>
                    <th className="p-4">Sipariş Durumu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium align-top">
                  {visibleOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="p-4 font-mono text-[11px] text-neutral-500">
                        {order.id.slice(0, 8)}...
                        <span className="block text-[10px] text-neutral-400 mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString("tr-TR")}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-neutral-900 block">{order.user.name}</span>
                        <span className="text-neutral-500 text-[11px] block">{cleanGuestEmail(order.user.email)}</span>
                        {order.phone && (
                          <span className="text-neutral-500 text-[11px] font-mono block mt-0.5">
                            📞 {order.phone}
                          </span>
                        )}
                        <span className="text-neutral-500 text-[10px] block mt-0.5">
                          🧾 {order.invoiceType === "CORPORATE"
                            ? `Kurumsal: ${order.companyTitle ?? "-"} • VD: ${order.taxOffice ?? "-"} • VKN: ${order.taxNumber ?? "-"}`
                            : `Bireysel${order.taxNumber ? ` • T.C. ${order.taxNumber}` : ""}`}
                        </span>
                        {order.orderNote && (
                          <span className="block mt-1.5 max-w-xs rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-950 whitespace-pre-line">
                            📝 <strong>Sipariş Notu:</strong> {order.orderNote}
                          </span>
                        )}
                        {order.address && (
                          <span className="text-neutral-400 text-[10px] block mt-0.5 max-w-xs line-clamp-2">
                            📍 {order.address}{" "}
                            {order.buyerCityName || order.buyerStateName
                              ? `(${order.buyerCityName || ""} / ${order.buyerStateName || ""})`
                              : ""}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {order.items.map((item) => (
                          <div key={item.id} className="text-xs">
                            <span className="font-semibold text-neutral-800">
                              {item.quantity}x {item.variation.variationValue}
                            </span>
                          </div>
                        ))}
                      </td>
                      <td className="p-4 space-y-1">
                        {order.shippingType === "BEYOGLU_MAGAZA_TESLIM" ? (
                          <span className="inline-block bg-amber-100 text-amber-900 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                            📍 Mağazadan Teslim
                          </span>
                        ) : (
                          <span className="inline-block bg-blue-100 text-blue-900 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                            📦 Adrese Teslim
                          </span>
                        )}
                        <div className="font-bold text-neutral-900 text-sm pt-1">
                          {order.totalAmount.toLocaleString("tr-TR")} ₺
                        </div>
                      </td>
                      <td className="p-4">
                        <AdminKargonomiOrderActions order={order} />
                      </td>
                      <td className="p-4">
                        {order.status === "AWAITING_PAYMENT" && (
                          <span className="inline-block mb-2 bg-yellow-100 text-yellow-900 border border-yellow-300 text-[11px] font-bold px-2.5 py-1 rounded-full">
                            Sipariş Denemesi (Ödeme Tamamlanmadı)
                          </span>
                        )}
                        {order.status === "PAYMENT_FAILED" && (
                          <span className="inline-block mb-2 bg-red-100 text-red-800 border border-red-200 text-[11px] font-bold px-2.5 py-1 rounded-full">
                            Ödeme Başarısız
                          </span>
                        )}
                        {order.status === "PENDING_NEW" && order.paymentMethod === "BANK_TRANSFER" && (
                          <AdminReceiptActions orderId={order.id} hasReceipt={Boolean(order.receiptUrl)} senderName={order.receiptSenderName} />
                        )}
                        <OrderStatusSelector
                          orderId={order.id}
                          initialStatus={order.status}
                          shippingType={order.shippingType}
                        />
                        {order.status === "DELIVERED" && (
                          <AdminInvoice orderId={order.id} state={invoices.state} meta={invoices.byOrder[order.id] ?? null} />
                        )}
                        <AdminDeleteButton endpoint="/api/admin/orders" ids={[order.id]} label="Siparişi Sil" confirmText="Bu sipariş ve bağlı fatura/dekont kayıtları silinecek." className="mt-2" />
                        <AdminOrderRequest
                          orderId={order.id}
                          type={order.cancelReturnType}
                          status={order.cancelReturnStatus}
                          reason={order.cancelReturnReason}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminSection>

        {/* 5. Gelen Mesajlar & Sorular */}
        <AdminSection
          id="mesajlar"
          title="Gelen Mesajlar & Ürün Soruları"
          description="İletişim formu mesajları ve ürün soruları. Yanıtınız müşteriye e-posta ile iletilir ve hesabında görünür."
          badges={[{ label: `${pendingMessages} okunmamış`, tone: pendingMessages > 0 ? "amber" : "neutral" }]}
        >
        <AdminMessages
          messages={sortedMessages.map((m) => ({
            id: m.id,
            kind: m.kind,
            name: m.name,
            email: m.email,
            phone: m.phone,
            subject: m.subject,
            message: m.message,
            status: m.status,
            reply: m.reply,
            repliedAt: m.repliedAt?.toISOString() ?? null,
            createdAt: m.createdAt.toISOString(),
            productTitle: m.product?.title ?? null,
          }))}
        />
        </AdminSection>

        {/* 6. Müşteri Yorumları & Fotoğraflar */}
        <AdminSection
          id="yorumlar"
          title="Müşteri Yorumları & Fotoğraflar"
          description="Yorumlar ve fotoğraflar onaylanana kadar sitede görünmez. Yeşil tik yayınlar, kırmızı çarpı reddeder."
          badges={[{ label: `${pendingReviews} onay bekliyor`, tone: pendingReviews > 0 ? "amber" : "neutral" }]}
        >
          <AdminReviews
            reviews={sortedReviews.map((r) => ({
              id: r.id,
              author: r.user.name,
              email: r.user.email,
              productTitle: r.product.title,
              rating: r.rating,
              comment: r.comment,
              imageUrl: r.imageUrl,
              status: r.status,
              createdAt: r.createdAt.toISOString(),
            }))}
          />
        </AdminSection>

        {/* 7. Kurumsal & Yasal Bilgiler */}
        <AdminSection
          id="kurumsal"
          title="Kurumsal & Yasal Bilgiler (MERSİS / KEP / ETBİS)"
          description="Footer ve İletişim sayfasında görünen unvan, vergi, MERSİS, KEP, adres ve ETBİS karekodu."
        >
          <AdminCompany initial={company} />
        </AdminSection>

        {/* 8. Müşteriler & Son 3 Gün Hareket/Hata Kaydı */}
        <AdminSection
          id="musteri-hareketleri"
          title="Müşteriler & Son 3 Gün Hareket / Hata Kaydı"
          description="Arama, sepete ekleme, ödeme adımı ve karşılaşılan hatalar. Kayıtlar 3 gün sonra otomatik silinir."
          badges={[
            {
              label: `${[...activity.registered, ...activity.guests].reduce((n, r) => n + r.errors.length, 0)} hata`,
              tone: [...activity.registered, ...activity.guests].some((r) => r.errors.length > 0) ? "red" : "neutral",
            },
          ]}
        >
          <AdminActivity registered={activity.registered} guests={activity.guests} ok={activity.ok} />
        </AdminSection>
      </div>
    </main>
  );
}
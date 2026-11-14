import { requireAdminPage } from "@/lib/admin-guard";
import { reservationExpiresAt } from "@/lib/stock-rules";
import { istanbulDateTimeParts } from "@/lib/format-date";
import { getExtraCategoryNames } from "@/lib/category-list";
import { cleanGuestEmail } from "@/lib/guest-email";
import { maskEmail } from "@/lib/admin-password";
import AdminPayoutCard from "@/components/AdminPayoutCard";
import AdminOrderBreakdown from "@/components/AdminOrderBreakdown";
import { PAYOUT_EXCLUDED_STATUSES, buildPayouts, payoutWindowStart } from "@/lib/payout";
import Link from "next/link";
import { ArrowLeft, Building2, KeyRound, MapPin, MessageSquare, Package, Phone, Receipt, ShieldCheck, ShoppingBag, Star, StickyNote, Truck, Users } from "lucide-react";
import AdminSectionNav from "@/components/AdminSectionNav";
import nextDynamic from "next/dynamic";
import { prisma } from "@/lib/db";
import OrderStatusSelector from "@/components/OrderStatusSelector";
import AdminKargonomiHeader from "@/components/AdminKargonomiHeader";
import AdminTrendyolSync from "@/components/AdminTrendyolSync";
import { resolveSyncModes } from "@/lib/trendyol-modes";
import AdminKargonomiOrderActions from "@/components/AdminKargonomiOrderActions";
import { FEATURED } from "@/lib/products";
import { getHomepageConfig, getHomepageRaw } from "@/lib/homepage";
import { getAdminSectionPools } from "@/lib/homepage-admin";
import { resolvePromoCards } from "@/lib/promo-cards";
import { resolveCollectionKeys } from "@/lib/collections";
import { resolveHiddenBestSellers } from "@/lib/homepage-compose";
import { getCategoryList, getCategorySettings } from "@/lib/category-list";
import { uncategorizedCount } from "@/lib/category-settings";
import { productInCategory } from "@/lib/categories";
import { resolveStocklessRule } from "@/lib/stockless";
import AdminDiscountSettings from "@/components/AdminDiscountSettings";
import AdminLowStock from "@/components/AdminLowStock";
import { resolveLowStock } from "@/lib/low-stock";
import AdminSessions from "@/components/AdminSessions";
import AdminTwoFactor, { AdminTwoFactorBanner } from "@/components/AdminTwoFactor";
import AdminPasswordChange from "@/components/AdminPasswordChange";
import AdminLiveAlerts from "@/components/AdminLiveAlerts";
import AdminSection from "@/components/AdminSection";
import AdminReceiptActions from "@/components/AdminReceiptActions";
import AdminOrderRequest from "@/components/AdminOrderRequest";
import AdminCompany from "@/components/AdminCompany";
import AdminOrderFilters from "@/components/AdminOrderFilters";
import AdminInvoice from "@/components/AdminInvoice";
import AdminShipmentSync from "@/components/AdminShipmentSync";
import AdminDeleteButton from "@/components/AdminDeleteButton";
import { titleCaseTr } from "@/lib/display-case";
import { countRecentErrors, purgeOldEvents } from "@/lib/activity";
import { getCompanyInfo } from "@/lib/company";
import { UNCOUNTED_STATUSES, matchesGroups, parseGroupParam } from "@/lib/orderStatus";
import { ORDER_LIST_LIMIT, countGroups, countVisible, dateWhere, effectiveDurum, groupsWhere } from "@/lib/admin-order-query";
import { getInvoiceMeta } from "@/lib/invoice";
import { orderItemProductView } from "@/lib/order-item-product";
import { adminOrderHref } from "@/lib/admin-order-detail";
import { recipientDiffers, recipientLabel } from "@/lib/recipient";
import { deleteButtonLabel, deleteConfirmText } from "@/lib/bulk-delete";
import { matchesOrderSearch, resolveDateRange, type DateRange } from "@/lib/admin-order-search";
import { smallImage } from "@/lib/img";
import { ADMIN_LIST_PRODUCT_SELECT, withCover } from "@/lib/admin-product-list";
import { loadAdminCovers } from "@/lib/admin-product-covers";
import { prismaCopyStore } from "@/lib/image-copy-store";

// Büyük ve ilk görünümde kapalı bölümlerde duran bileşenler ayrı parçada yüklenir (davranış aynı)
const AdminProductList = nextDynamic(() => import("@/components/AdminProductList"));
const AdminAddProduct = nextDynamic(() => import("@/components/AdminAddProduct"));
const AdminHomepage = nextDynamic(() => import("@/components/AdminHomepage"));
const AdminCategories = nextDynamic(() => import("@/components/AdminCategories"));
const AdminCoupons = nextDynamic(() => import("@/components/AdminCoupons"));
const AdminActivity = nextDynamic(() => import("@/components/AdminActivity"));
const AdminMessages = nextDynamic(() => import("@/components/AdminMessages"));
const AdminReviews = nextDynamic(() => import("@/components/AdminReviews"));
const AdminAccountDeletions = nextDynamic(() => import("@/components/AdminAccountDeletions"));

export const dynamic = "force-dynamic";

async function getAdminData() {
  const [productRows, covers, uncopied, messages, coupons, customers, reviews, company] = await Promise.all([
    prisma.product.findMany({
      // Dar liste: yalnız listenin kullandığı alanlar. Açıklama ve tüm görsel dizileri düzenleyici açılınca tek ürün için okunur (GET /api/admin/product).
      select: ADMIN_LIST_PRODUCT_SELECT,
      orderBy: { createdAt: "desc" },
    }),
    loadAdminCovers(), // kapak veritabanında hesaplanır (görsel dizileri çekilmez); hata olursa kapaksız
    Promise.resolve(prismaCopyStore.count?.([])).then((c) => c?.kalan ?? 0).catch(() => 0), // "Blob'a kopyalanmamış": tek sayı, veritabanında sayılır

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

  const products = withCover(productRows, covers);
  return { products, uncopied, messages, coupons, customers, reviews, company };
}

const ORDER_INCLUDE = {
  user: { select: { name: true, email: true } },
  items: {
    include: {
      variation: {
        omit: { syncSnapshot: true, syncStock: true },
        include: { product: { select: { id: true, title: true, imageUrl: true, images: true } } },
      },
    },
  },
} as const;

/**
 * Sipariş bölümü: tüm siparişleri yüklemek yerine sayaçlar GROUP BY / toplama sorgularıyla, liste ise en çok ORDER_LIST_LIMIT kayıtla gelir.
 * - Arama yokken: tarih + durum grupları doğrudan sorguya girer.
 * - Arama (q) varken: Türkçe/aksan duyarsız eşleşme bellekte yapılır; bunun için YALNIZ hafif alanlar (kimlik, ad, e-posta, telefon, durum) okunur, kalemler/ürünler değil.
 */
async function getOrderPanel(q: string, range: DateRange | null, keys: ReturnType<typeof parseGroupParam>) {
  const dw = dateWhere(range);
  const counted = { status: { notIn: UNCOUNTED_STATUSES } };
  const [globalGroups, countedAgg, pendingAgg, openShipmentCount, beyogluCount, beyogluDelivered] = await Promise.all([
    prisma.order.groupBy({ by: ["status", "cancelReturnStatus"], _count: { _all: true } }),
    prisma.order.aggregate({ where: counted, _count: { _all: true }, _sum: { totalAmount: true } }),
    prisma.order.aggregate({ where: { status: "PENDING_NEW", paymentMethod: "BANK_TRANSFER" }, _count: { _all: true }, _sum: { totalAmount: true } }),
    prisma.order.count({ where: { kargonomiShipmentId: { not: null }, status: { in: ["PENDING", "SHIPPED"] } } }),
    prisma.order.count({ where: { ...counted, shippingType: "BEYOGLU_MAGAZA_TESLIM" } }),
    prisma.order.count({ where: { status: "DELIVERED", shippingType: "BEYOGLU_MAGAZA_TESLIM" } }),
  ]);
  const toRows = (g: typeof globalGroups) => g.map((r) => ({ status: r.status, cancelReturnStatus: r.cancelReturnStatus, n: r._count._all }));
  const globalRows = toRows(globalGroups);

  let scopeRows = globalRows;
  let visibleCount: number;
  let orders;
  if (q.trim()) {
    const light = await prisma.order.findMany({
      where: dw ?? undefined,
      select: { id: true, status: true, cancelReturnStatus: true, phone: true, recipientName: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    const matched = light.filter((o) => matchesOrderSearch(o, q));
    scopeRows = matched.map((o) => ({ status: o.status, cancelReturnStatus: o.cancelReturnStatus, n: 1 }));
    const visibleIds = matched.filter((o) => matchesGroups(o, keys)).map((o) => o.id);
    visibleCount = visibleIds.length;
    orders = visibleIds.length
      ? await prisma.order.findMany({ where: { id: { in: visibleIds.slice(0, ORDER_LIST_LIMIT) } }, include: ORDER_INCLUDE, orderBy: { createdAt: "desc" } })
      : [];
  } else {
    if (dw) {
      const scoped = await prisma.order.groupBy({ by: ["status", "cancelReturnStatus"], where: dw, _count: { _all: true } });
      scopeRows = toRows(scoped);
    }
    visibleCount = countVisible(scopeRows, keys);
    orders = await prisma.order.findMany({ where: { ...(dw ?? {}), ...(groupsWhere(keys) ?? {}) }, include: ORDER_INCLUDE, orderBy: { createdAt: "desc" }, take: ORDER_LIST_LIMIT });
  }
  const all = countGroups(globalRows);
  const scope = countGroups(scopeRows);
  return {
    orders,
    visibleCount,
    allGroupCounts: all.counts, // bölüm rozetleri süzgeçten bağımsız
    groupCounts: scope.counts,
    scopedTotal: scope.total,
    totalAll: all.total,
    attemptCount: globalRows.filter((r) => r.status === "AWAITING_PAYMENT").reduce((n, r) => n + r.n, 0),
    countedCount: countedAgg._count._all,
    totalRevenue: countedAgg._sum.totalAmount ?? 0,
    pendingTransferCount: pendingAgg._count._all,
    pendingTransferTotal: pendingAgg._sum.totalAmount ?? 0,
    openShipmentCount,
    beyogluCount,
    beyogluDelivered,
  };
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ durum?: string; q?: string; tarih?: string; bas?: string; bit?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const durumParam = sp.durum;
  const orderFilters = { q: sp.q, tarih: sp.tarih, bas: sp.bas, bit: sp.bit };
  const { products, uncopied, messages, coupons, customers, reviews, company } = await getAdminData();
  const extraCategories = await getExtraCategoryNames(); // yönetim panelinden eklenen kategoriler (form/toplu işlem seçenekleri)
  // Vitrin çipleri için sitedeki kümeler: Öne Çıkanlar = işaretliler (yoksa otomatik seçim), Çok Satanlar = kategori sayfasındaki liste
  const flaggedFeatured = await prisma.product.findMany({ where: { active: true, isFeatured: true }, select: { id: true } });
  const featuredIds = flaggedFeatured.length > 0 ? flaggedFeatured : await prisma.product.findMany({ where: { active: true, ...FEATURED }, select: { id: true } });
  // Ana Sayfayı Düzenle: bölüm havuzları (yalnızca ilgili kümeden seçilebilir) ve kayıtlı ayar
  const [homeConfig, homePools, homeRaw] = await Promise.all([getHomepageConfig(), getAdminSectionPools(), getHomepageRaw()]);
  const categoryList = await getCategoryList().catch(() => []);
  const categorySettings = await getCategorySettings();
  // Kategori satırı: "yayında" = vitrin sayısı (c.count), "toplam" = pasifler dahil o kategorideki tüm ürünler (Tüm Ürünler filtresindeki sayı)
  const categoryEntries = categoryList.map((c) => ({ key: c.key, slug: c.slug, title: c.title, count: c.count, total: products.filter((p) => productInCategory(p.category, c)).length, fixed: c.fixed }));
  const collectionOptions = categoryList.map((c) => ({ key: c.key, title: c.title, count: c.count })); // ana sayfa koleksiyon seçenekleri
  // Çok Satanlar: bölüm havuzu (100) aynı sıralamanın uzun hâlidir; ilk 48 = getBestSellers(48) (ikinci sorgu yapılmaz)
  const showcase = { featured: featuredIds.map((p) => p.id), bestSellers: homePools.bestsellers.slice(0, 48).map((p) => p.id), manualFeatured: flaggedFeatured.length };
  const slim = (list: { id: string; title: string; modelCode: string | null }[]) => list.map((p) => ({ id: p.id, title: p.title, modelCode: p.modelCode }));
  // Hareket kayıtları sayfada yüklenmez (bölüm açılınca /api/admin/activity); yalnız hata rozeti için sayım. 3 günlük saklama süresi için eski kayıt temizliği eskisi gibi her yüklemede çalışır.
  const [errorCount, , discountRow] = await Promise.all([
    countRecentErrors(),
    purgeOldEvents(),
    prisma.siteConfig.findUnique({ where: { id: 1 }, select: { maxTotalDiscountPct: true } }),
  ]);
  const discountCap = discountRow?.maxTotalDiscountPct ?? null;
  // 2FA kapalı yönetici hesabı sayısı (uyarı bandı için); okunamazsa band gösterilmez
  const adminUsers = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true, email: true, twoFactorEnabled: true }, orderBy: { createdAt: "asc" } }).catch(() => []);
  const adminsWithout2fa = adminUsers.filter((a) => !a.twoFactorEnabled).length;
  const adminRows = adminUsers.map((a) => ({ id: a.id, maskedEmail: maskEmail(a.email), twoFactorEnabled: a.twoFactorEnabled })); // tam e-posta istemciye gitmez
  // Kuveyt Türk hesabı (yalnızca gösterim): son ~35 günün kartlı, ödemesi alınmış siparişleri; ayrı hafif sorgu (yalnızca gerekli alanlar)
  const payoutOrders = await prisma.order
    .findMany({
      where: { paymentMethod: "CREDIT_CARD", status: { notIn: PAYOUT_EXCLUDED_STATUSES }, createdAt: { gte: payoutWindowStart() } },
      select: { id: true, createdAt: true, totalAmount: true, paymentMethod: true, status: true },
    })
    .catch(() => []);
  const payout = buildPayouts(payoutOrders);
  const pendingReviews = reviews.filter((r) => r.status === "PENDING").length;
  const sortedReviews = [...reviews].sort(
    (a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING") || b.createdAt.getTime() - a.createdAt.getTime()
  );
  // Bekleyenler üstte, kendi içinde en yeni önce
  const sortedMessages = [...messages].sort(
    (a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING") || b.createdAt.getTime() - a.createdAt.getTime()
  );

  // Arama + tarih aralığı: durum çiplerinden önce uygulanır; çip sayaçları ve "Tümü" aynı kümeden çıkar (liste = çip seçimi ∩ arama ∩ tarih).
  // Varsayılan görünüm yalnız açık işlerdir; arama ya da tarih süzgeci kullanılırken (ve ?durum= verilmemişken) tüm durumlarda aranır.
  const dateRange = resolveDateRange(sp.tarih, sp.bas, sp.bit, new Date());
  const filtered = Boolean(sp.q?.trim()) || dateRange !== null;
  const effDurum = effectiveDurum(durumParam, filtered);
  const selectedGroups = parseGroupParam(effDurum);
  const panel = await getOrderPanel(sp.q ?? "", dateRange, selectedGroups);
  const { orders: visibleOrders, allGroupCounts, groupCounts } = panel;
  const pendingMessages = messages.filter((m) => m.status === "PENDING").length;
  const { totalRevenue, pendingTransferTotal, openShipmentCount } = panel;
  const bulkFilters = { ...orderFilters, durum: durumParam, dateActive: dateRange !== null };

  // Fatura bilgileri ana sipariş sorgusundan ayrı okunur; tablo yoksa panelin geri kalanı çalışır
  const deliveredIds = visibleOrders.filter((o) => o.status === "DELIVERED").map((o) => o.id);
  const invoices = await getInvoiceMeta(deliveredIds);

  return (
    <main className="min-h-screen bg-neutral-100 py-10 px-4 sm:px-6 lg:px-8">
      <AdminLiveAlerts />
      <div className="max-w-7xl mx-auto space-y-8">
        <AdminTwoFactorBanner missing={adminsWithout2fa} />
        {/* Üst Başlık */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-6">
          <div>
            <span className="text-xs uppercase tracking-widest text-amber-600 font-bold">
              Yıldırım Avize Yönetim Merkezi
            </span>
            <h1 className="text-3xl font-serif font-bold text-neutral-900 mt-1">
              <span className="sm:hidden">Sipariş &amp; Envanter</span>
              <span className="max-sm:hidden">Operasyon, Kargonomi &amp; Envanter Paneli</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/kargo-takip"
              className="text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-900 px-4 py-2.5 rounded-xl hover:bg-amber-100 transition-colors inline-flex items-center gap-1.5 w-fit"
            >
              <Truck aria-hidden="true" className="w-3.5 h-3.5 shrink-0" /> Kargo Takip Sayfası
            </Link>
            <Link
              href="/"
              className="text-xs font-semibold bg-white border border-neutral-300 text-neutral-700 px-4 py-2.5 rounded-xl hover:bg-neutral-50 transition-colors inline-flex items-center gap-1.5 w-fit"
            >
              <ArrowLeft aria-hidden="true" className="w-3.5 h-3.5 shrink-0" /> Mağaza Vitrinine Dön
            </Link>
          </div>
        </div>

        {/* Yapışkan "bölüme git" çubuğu: günlük işler şeritte, diğer bölümler "Tümü" panelinde (kapalı bölümü açar) */}
        <AdminSectionNav
          daily={[
            { id: "siparisler", label: "Siparişler", badge: allGroupCounts.yeni },
            { id: "mesajlar", label: "Mesajlar", badge: pendingMessages },
            { id: "urunler", label: "Tüm Ürünler" },
            { id: "yorumlar", label: "Yorumlar", badge: pendingReviews },
            { id: "musteri-hareketleri", label: "Müşteriler" },
          ]}
          groups={[
            {
              title: "Katalog",
              items: [
                { id: "yeni-avize", label: "Yeni Avize" },
                { id: "kategoriler", label: "Kategoriler" },
                { id: "trendyol", label: "Trendyol" },
              ],
            },
            {
              title: "Vitrin ve kampanya",
              items: [
                { id: "ana-sayfa", label: "Ana Sayfa" },
                { id: "kuponlar", label: "Promosyon Kodları" },
                { id: "indirim", label: "İndirim Ayarları" },
                { id: "stok-rozeti", label: "Stok Rozeti" },
              ],
            },
            {
              title: "Ayarlar ve güvenlik",
              items: [
                { id: "kurumsal", label: "Kurumsal" },
                { id: "kargonomi", label: "Kargonomi" },
                { id: "hesap-silme", label: "Hesap Silme" },
                { id: "oturumlar", label: "Oturumlar" },
                { id: "guvenlik", label: "İki Aşamalı Doğrulama" },
                { id: "yonetici-sifre", label: "Şifre" },
              ],
            },
          ]}
        />

        {/* 1. Özet İstatistik Kartları */}
        <div className="grid grid-flow-dense grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
            <span className="text-xs text-neutral-500 font-medium block">Toplam Ciro</span>
            <span className="text-2xl font-bold text-neutral-900 mt-1 block">
              {totalRevenue.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
            </span>
          </div>

          <AdminPayoutCard summary={payout} />

          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
            <span className="text-xs text-neutral-500 font-medium block">Bekleyen Havale/EFT</span>
            <span className="text-2xl font-bold text-neutral-900 mt-1 block break-words">
              {pendingTransferTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
            </span>
            <span className="text-[11px] text-neutral-500 mt-1 block">{panel.pendingTransferCount} sipariş, ödeme onayı bekliyor</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
            <span className="text-xs text-neutral-500 font-medium block">Geçerli Sipariş</span>
            <span className="text-2xl font-bold text-neutral-900 mt-1 block">
              {panel.countedCount} adet
            </span>
            <span className="text-[11px] text-neutral-600 font-semibold mt-1 block">
              Geçerli: {panel.countedCount} · Tüm kayıt: {panel.totalAll}
            </span>
            <span className="text-[11px] text-neutral-500 block">
              Geçerli: iptal, iade ve ödemesi tamamlanmayanlar hariç
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
              {panel.beyogluCount} sipariş • {panel.beyogluDelivered} teslim edilen
            </span>
            <span className="text-[11px] text-amber-800/70 mt-1 block">
              İptal, iade ve ödemesi tamamlanmayanlar hariç • Katalog: {products.length} model
            </span>
          </div>
        </div>

        {/* 4. Canlı Siparişler & Kargonomi Operasyon Tablosu */}
        <AdminSection
          id="siparisler"
          icon={<Package aria-hidden="true" className="w-4 h-4 text-amber-600" />}
          title="Gelen Siparişler, Durum & Kargonomi Yönetimi"
          description="Havale ödemesini onaylayabilir, sipariş durumunu yürütebilir, Aras Kargo barkodu oluşturup PDF çıktısı alabilirsiniz."
          badges={[
            { label: `${allGroupCounts.yeni} yeni gelen`, tone: allGroupCounts.yeni > 0 ? "amber" : "neutral" },
            ...(allGroupCounts.talep > 0 ? [{ label: `${allGroupCounts.talep} talep bekliyor`, tone: "red" as const }] : []),
            ...(panel.attemptCount > 0 ? [{ label: `${panel.attemptCount} deneme`, tone: "neutral" as const }] : []),
          ]}
        >
          <AdminOrderFilters param={durumParam} effectiveParam={effDurum} counts={groupCounts} total={panel.scopedTotal} filters={orderFilters} />
          <div className="flex flex-wrap items-center justify-end gap-3 px-6 pt-4">
            <AdminShipmentSync />
          </div>
          {panel.totalAll === 0 ? (
            <div className="p-12 text-center text-neutral-500 text-xs">
              Henüz verilmiş bir sipariş bulunmuyor.
            </div>
          ) : visibleOrders.length === 0 ? (
            <div className="p-12 text-center text-neutral-500 text-xs">
              Seçili durum, arama ve tarih filtrelerine uyan sipariş yok. Yukarıdan başka bir filtre seçebilir, aramayı temizleyebilir veya &quot;Tümü&quot;nü açabilirsiniz.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full max-sm:block text-left text-xs text-neutral-700">
                <thead className="max-sm:hidden bg-neutral-50 text-neutral-500 uppercase tracking-wider text-[10px] border-b border-neutral-200">
                  <tr>
                    <th className="p-4">Sipariş ID & Tarih</th>
                    <th className="p-4">Müşteri & Adres</th>
                    <th className="p-4">Alınan Avize</th>
                    <th className="p-4">Teslimat & Tutar</th>
                    <th className="p-4">Kargonomi API İşlemleri</th>
                    <th className="p-4">Sipariş Durumu</th>
                  </tr>
                </thead>
                <tbody className="max-sm:block divide-y divide-neutral-100 font-medium align-top">
                  {visibleOrders.map((order) => (
                    <tr key={order.id} className="max-sm:flex max-sm:flex-col max-sm:border-b-[6px] max-sm:border-neutral-300 hover:bg-neutral-50/80 transition-colors">
                      <td data-label="Sipariş ID & Tarih" className="max-sm:order-1 max-sm:flex max-sm:flex-col max-sm:before:content-[attr(data-label)] max-sm:before:text-[10px] max-sm:before:uppercase max-sm:before:tracking-wider max-sm:before:text-neutral-500 max-sm:before:mb-1 p-4 font-mono text-[11px] text-neutral-500">
                        <Link href={adminOrderHref(order.id)} className="inline-flex min-h-8 items-center font-semibold text-amber-700 underline hover:text-amber-900" aria-label={`Sipariş ${order.id.slice(0, 8)} detayı`}>
                          {order.id.slice(0, 8)}
                        </Link>
                        <time dateTime={order.createdAt.toISOString()} className="block text-[10px] text-neutral-500 mt-0.5">
                          {(() => {
                            const dt = istanbulDateTimeParts(order.createdAt);
                            // Dar ekranda tarih ve saat alt alta gelebilir (her parça kendi içinde bölünmez)
                            return dt ? (
                              <>
                                <span className="inline-block whitespace-nowrap">{dt.date}</span> <span className="inline-block whitespace-nowrap">{dt.time}</span>
                              </>
                            ) : (
                              "—"
                            );
                          })()}
                        </time>
                      </td>
                      <td data-label="Müşteri & Adres" className="max-sm:order-2 max-sm:flex max-sm:flex-col max-sm:before:content-[attr(data-label)] max-sm:before:text-[10px] max-sm:before:uppercase max-sm:before:tracking-wider max-sm:before:text-neutral-500 max-sm:before:mb-1 p-4">
                        <span className="font-bold text-neutral-900 block">{order.user.name}</span>
                        {recipientDiffers(order) && <span data-testid="alici-adi" className="text-amber-900 text-[11px] font-semibold block">{recipientLabel(order)}</span>}
                        <span className="text-neutral-500 text-[11px] block">{cleanGuestEmail(order.user.email)}</span>
                        {order.phone && (
                          <span className="text-neutral-500 text-[11px] font-mono mt-0.5 flex items-center gap-1">
                            <Phone aria-hidden="true" className="w-3.5 h-3.5 shrink-0" /> {order.phone}
                          </span>
                        )}
                        <span className="text-neutral-500 text-[10px] mt-0.5 flex items-start gap-1">
                          <Receipt aria-hidden="true" className="w-3.5 h-3.5 shrink-0" /> <span>{order.invoiceType === "CORPORATE"
                            ? `Kurumsal: ${order.companyTitle ?? "-"} • VD: ${order.taxOffice ?? "-"} • VKN: ${order.taxNumber ?? "-"}`
                            : `Bireysel${order.taxNumber ? ` • T.C. ${order.taxNumber}` : ""}`}</span>
                        </span>
                        {order.orderNote && (
                          <span className="block mt-1.5 max-w-xs rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-950 whitespace-pre-line">
                            <StickyNote aria-hidden="true" className="inline w-3.5 h-3.5 -mt-0.5" /> <strong>Sipariş Notu:</strong> {order.orderNote}
                          </span>
                        )}
                        {order.address && (
                          <span className="text-neutral-500 text-[10px] block mt-0.5 max-w-xs line-clamp-2">
                            <MapPin aria-hidden="true" className="inline w-3 h-3 -mt-0.5" /> {titleCaseTr(order.address)}{" "}
                            {order.buyerCityName || order.buyerStateName
                              ? `(${order.buyerCityName || ""} / ${order.buyerStateName || ""})`
                              : ""}
                          </span>
                        )}
                      </td>
                      <td data-label="Alınan Avize" className="max-sm:order-4 max-sm:flex max-sm:flex-col max-sm:before:content-[attr(data-label)] max-sm:before:text-[10px] max-sm:before:uppercase max-sm:before:tracking-wider max-sm:before:text-neutral-500 max-sm:before:mb-1 p-4">
                        {order.items.map((item) => {
                          const p = orderItemProductView(item.variation?.product);
                          const thumb = p.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={smallImage(p.image)} alt={p.title ?? "Ürün"} loading="lazy" width={48} height={48} className="w-12 h-12 rounded object-cover bg-neutral-100 shrink-0" />
                          ) : (
                            <span aria-hidden="true" className="w-12 h-12 rounded bg-neutral-200 shrink-0" />
                          );
                          return (
                            <div key={item.id} className="text-xs flex items-center gap-2 py-1">
                              {p.href ? (
                                <a href={p.href} target="_blank" rel="noopener" className="shrink-0">{thumb}</a>
                              ) : (
                                thumb
                              )}
                              <div className="min-w-0">
                                {p.title &&
                                  (p.href ? (
                                    <a href={p.href} target="_blank" rel="noopener" className="block font-bold text-neutral-900 line-clamp-2 hover:underline">{p.title}</a>
                                  ) : (
                                    <span className="block font-bold text-neutral-900 line-clamp-2">{p.title}</span>
                                  ))}
                                <span className="font-semibold text-neutral-800">
                                  {item.quantity}x {item.variation?.variationValue}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </td>
                      <td data-label="Teslimat & Tutar" className="max-sm:order-5 max-sm:flex max-sm:flex-col max-sm:before:content-[attr(data-label)] max-sm:before:text-[10px] max-sm:before:uppercase max-sm:before:tracking-wider max-sm:before:text-neutral-500 max-sm:before:mb-1 p-4 space-y-1">
                        {order.shippingType === "BEYOGLU_MAGAZA_TESLIM" ? (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                            <MapPin aria-hidden="true" className="w-3.5 h-3.5 shrink-0" /> Mağazadan Teslim
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-900 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                            <Package aria-hidden="true" className="w-3.5 h-3.5 shrink-0" /> Adrese Teslim
                          </span>
                        )}
                        <div className="font-bold text-neutral-900 text-sm pt-1 whitespace-nowrap">
                          {order.totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </div>
                        <AdminOrderBreakdown
                          itemsTotal={order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)}
                          totalAmount={order.totalAmount}
                          couponCode={order.couponCode}
                          isPickup={order.shippingType === "BEYOGLU_MAGAZA_TESLIM"}
                          isTransfer={order.paymentMethod === "BANK_TRANSFER"}
                        />
                      </td>
                      <td data-label="Kargonomi API İşlemleri" className="max-sm:order-6 max-sm:flex max-sm:flex-col max-sm:before:content-[attr(data-label)] max-sm:before:text-[10px] max-sm:before:uppercase max-sm:before:tracking-wider max-sm:before:text-neutral-500 max-sm:before:mb-1 p-4">
                        {/* İstemciye yalnızca gereken alanlar gider (tam sipariş nesnesi müşteri kaydını, parola özetini de taşırdı) */}
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
                      </td>
                      <td data-label="Sipariş Durumu" className="max-sm:order-3 max-sm:bg-neutral-50 max-sm:flex max-sm:flex-col max-sm:before:content-[attr(data-label)] max-sm:before:text-[10px] max-sm:before:uppercase max-sm:before:tracking-wider max-sm:before:text-neutral-500 max-sm:before:mb-1 p-4">
                        {order.status === "AWAITING_PAYMENT" && order.paymentMethod === "CREDIT_CARD" && (
                          <p className="mb-2 text-[11px] text-neutral-600">
                            Stok tutma bitişi: {reservationExpiresAt(order.createdAt).toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" })}
                          </p>
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
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] font-semibold text-neutral-500 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-600">Tehlikeli işlemler</summary>
                          <AdminDeleteButton endpoint="/api/admin/orders" ids={[order.id]} label="Siparişi Sil" confirmText="Bu sipariş ve bağlı fatura/dekont kayıtları kalıcı olarak silinecek; ayrılmış stok iade edilir." className="mt-2" />
                        </details>
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
          {panel.visibleCount > visibleOrders.length && (
            <p className="border-t border-neutral-200 px-6 py-3 text-[11px] font-semibold text-amber-800 bg-amber-50/60">İlk {ORDER_LIST_LIMIT} kayıt gösteriliyor; aramayla daralt.</p>
          )}
          {visibleOrders.length > 0 && (
            <details className="border-t border-neutral-200 px-6 py-3 text-xs">
              <summary className="cursor-pointer font-semibold text-neutral-600 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-600">Tehlikeli işlemler</summary>
              <div className="mt-3 space-y-2">
                <p className="text-neutral-600">Aşağıdaki işlem, yukarıda listelenen tüm siparişleri (arama ve tarih süzgeçleri dahil) siler. Silmeden önce sayfa içi onay ve yazılı onay istenir.</p>
                <AdminDeleteButton
                  endpoint="/api/admin/orders"
                  ids={visibleOrders.map((o) => o.id)}
                  label={deleteButtonLabel(visibleOrders.length, bulkFilters)}
                  confirmText={deleteConfirmText(visibleOrders.length, bulkFilters)}
                  expectedCount={visibleOrders.length}
                  typeToConfirm
                />
              </div>
            </details>
          )}
        </AdminSection>

        {/* 5. Gelen Mesajlar & Sorular */}
        <AdminSection
          id="mesajlar"
          icon={<MessageSquare aria-hidden="true" className="w-4 h-4 text-amber-600" />}
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

        {/* 3. Canlı Avize Kataloğu & Stok Yönetimi */}
        <AdminProductList products={products} maxTotalDiscountPct={discountCap} showcase={showcase} extraCategories={extraCategories} categoryTitles={Object.fromEntries(Object.entries(categorySettings).flatMap(([k, s]) => (s.title ? [[k, s.title]] : [])))} stocklessRule={resolveStocklessRule(homeRaw)} />

        {/* 6. Müşteri Yorumları & Fotoğraflar */}
        <AdminSection
          id="yorumlar"
          icon={<Star aria-hidden="true" className="w-4 h-4 text-amber-600" />}
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

        {/* Promosyon Kodları Yönetimi */}
        <AdminCoupons
          coupons={coupons.map((c) => ({
            id: c.id,
            code: c.code,
            discountPercent: c.discountPercent,
            expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
            discountType: c.discountType,
            discountAmount: c.discountAmount,
            minCartTotal: c.minCartTotal,
            perUserLimit: c.perUserLimit,
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

        {/* 2. Hızlı Avize Ekleme Modülü */}
        <AdminAddProduct extraCategories={extraCategories} categoryTitles={Object.fromEntries(Object.entries(categorySettings).flatMap(([k, s]) => (s.title ? [[k, s.title]] : [])))} />

        <AdminCategories
          entries={categoryEntries}
          settings={categorySettings}
          uncategorized={uncategorizedCount(products)}
          showStockless={resolveStocklessRule(homeRaw).global}
        />

        <AdminHomepage
          initial={homeConfig}
          promoCards={resolvePromoCards(homeRaw)}
          collectionOptions={collectionOptions}
          savedCollections={resolveCollectionKeys(homeRaw)}
          pools={{ featured: slim(homePools.featured), discounted: slim(homePools.discounted), bestsellers: slim(homePools.bestsellers) }}
          hiddenBestSellers={slim(resolveHiddenBestSellers(homeRaw).flatMap((id) => products.filter((p) => p.id === id)))}
        />

        {/* 7. Kurumsal & Yasal Bilgiler */}
        <AdminSection
          id="kurumsal"
          icon={<Building2 aria-hidden="true" className="w-4 h-4 text-amber-600" />}
          title="Kurumsal & Yasal Bilgiler (MERSİS / KEP / ETBİS)"
          description="Footer ve İletişim sayfasında görünen unvan, vergi, MERSİS, KEP, adres ve ETBİS karekodu."
        >
          <AdminCompany initial={company} />
        </AdminSection>

        {/* 8. Müşteriler & Son 3 Gün Hareket/Hata Kaydı */}
        <AdminSection
          id="musteri-hareketleri"
          icon={<Users aria-hidden="true" className="w-4 h-4 text-amber-600" />}
          title="Müşteriler & Son 3 Gün Hareket / Hata Kaydı"
          description="Arama, sepete ekleme, ödeme adımı ve karşılaşılan hatalar. Kayıtlar 3 gün sonra otomatik silinir."
          badges={[{ label: `${errorCount} hata`, tone: errorCount > 0 ? "red" : "neutral" }]}
        >
          <AdminActivity />
        </AdminSection>

        <AdminDiscountSettings initial={discountCap} />
        <AdminLowStock initial={resolveLowStock(homeRaw)} />
        <AdminAccountDeletions />
        <AdminSessions />
        <AdminSection id="guvenlik" icon={<ShieldCheck aria-hidden="true" className="w-4 h-4 text-amber-600" />} title="İki Aşamalı Doğrulama (Yönetici Hesapları)" description="Yönetici girişine e-posta kodu ekleyin veya kapatın.">
          <AdminTwoFactor admins={adminRows} />
        </AdminSection>
        <AdminSection id="yonetici-sifre" icon={<KeyRound aria-hidden="true" className="w-4 h-4 text-amber-600" />} title="Yönetici Şifresini Değiştir" description="E-posta kodu ile yönetici hesabının şifresini yenileyin.">
          <AdminPasswordChange />
        </AdminSection>

        {/* Kargonomi API v1 Canlı Kontrol & Bakiye Barı */}
        <AdminKargonomiHeader />

        {/* Trendyol ürün senkronizasyonu (varsayılan kapalı; bileşen state'i gövde gizliyken de korunur) */}
        <AdminSection id="trendyol" icon={<ShoppingBag aria-hidden="true" className="w-4 h-4 text-amber-600" />} title="Trendyol Ürünleri" description="Mağazadaki ürünleri, fiyat ve stokları Trendyol'dan önizleyip seçerek güncelleyin.">
          <AdminTrendyolSync initial={resolveSyncModes(homeRaw)} uncopiedImages={uncopied} />
        </AdminSection>
      </div>
    </main>
  );
}
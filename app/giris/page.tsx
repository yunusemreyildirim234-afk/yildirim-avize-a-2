"use client";

import { toast } from "sonner";
import { useState, useEffect } from "react";
import PasswordInput from "@/components/PasswordInput";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { carrierTrackingLink } from "@/lib/carrier-links";
import MyMessages from "@/components/MyMessages";
import MyCoupons from "@/components/MyCoupons";
import OrderRequestBox from "@/components/OrderRequestBox";
import OrderTracker from "@/components/OrderTracker";
import AuthForms from "@/components/AuthForms";
import AccountSecurity from "@/components/AccountSecurity";
import AccountDeletion from "@/components/AccountDeletion";
import CodeStep from "@/components/CodeStep";
import ProfileName from "@/components/ProfileName";
import AddressBook from "@/components/AddressBook";
import ReceiptUpload from "@/components/ReceiptUpload";
import OrderBankBox from "@/components/OrderBankBox";
import CopyCodeButton from "@/components/CopyCodeButton";
import CopyTrackingCode from "@/components/CopyTrackingCode";
import { breakdownOf, formatTl, orderCode } from "@/lib/order-display";
import { discountLabel } from "@/lib/order-discount-label";
import { titleCaseTr } from "@/lib/display-case";
import { MarketingPermissions } from "@/components/MarketingPrefs";
import { smallImage } from "@/lib/img";
import { displayTitle } from "@/lib/title-display";
import { productPath } from "@/lib/product-url";

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  variation: { variationValue: string; product?: { id: string; title: string; imageUrl?: string | null } };
}

interface Order {
  id: string;
  receiptUrl?: string | null;
  receiptSenderName?: string | null;
  paymentMethod?: string | null;
  kargonomiStatus?: string | null;
  updatedAt?: string;
  totalAmount: number;
  shippingType: string;
  status: string;
  kargonomiShipmentId?: number | null;
  kargonomiStatusLabel?: string | null;
  shippingProviderName?: string | null;
  shippingTrackingCode?: string | null;
  shippingBarcode?: string | null;
  cancelReturnType?: string | null;
  cancelReturnStatus?: string | null;
  cancelReturnReason?: string | null;
  cancelReturnNote?: string | null;
  couponCode?: string | null;
  address?: string | null;
  buyerCityName?: string | null;
  buyerStateName?: string | null;
  createdAt: string;
  items: OrderItem[];
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  twoFactorEnabled?: boolean;
  orders?: Order[];
}

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"musteri" | "yonetici">("musteri");
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL parametresi ilk render sonrası okunur
    if (params.get("tab") === "yonetici") setTab("yonetici");

    fetch("/api/auth/me?orders=1")
      .then((res) => res.json())
      .then((data) => data.user && setUser(data.user))
      .catch(() => {});
  }, []);

  // Faturası yüklenmiş siparişler: ana sipariş sorgusundan ayrı alınır; hata olursa fatura düğmesi görünmez, sayfa etkilenmez
  const [invoiceIds, setInvoiceIds] = useState<string[]>([]);
  const hasUser = Boolean(user);
  useEffect(() => {
    if (!hasUser) return;
    fetch("/api/orders/invoices")
      .then((res) => res.json())
      .then((data) => Array.isArray(data.orderIds) && setInvoiceIds(data.orderIds))
      .catch(() => {});
  }, [hasUser]);

  // İçerik sonradan geldiği için #çapa tarayıcıca bulunamaz: sipariş verisi yüklenince bir kez kaydır
  const ordersLoaded = Boolean(user?.orders);
  useEffect(() => {
    if (!ordersLoaded) return;
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, [ordersLoaded]);

  // Girişliyken sekme başlığı "Hesabım" (layout başlığı giriş formu içindir)
  useEffect(() => {
    if (hasUser) document.title = "Hesabım | Yıldırım Avize";
  }, [hasUser]);

  const refreshUser = () => {
    fetch("/api/auth/me?orders=1", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => data.user && setUser(data.user))
      .catch(() => {});
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.dispatchEvent(new Event("ya-auth"));
    router.refresh();
  };

  const handleLogoutAll = async () => {
    if (!confirm("Tüm cihazlardaki oturumlarınız kapatılacak (bu cihazda açık kalırsınız). Devam edilsin mi?")) return;
    try {
      const res = await fetch("/api/auth/logout-all", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "İşlem başarısız.");
      toast.success("Diğer tüm cihazlardaki oturumlar kapatıldı.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (user) {
    return (
      <main className="min-h-screen bg-canvas py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8 pb-24">
          <div className="bg-raised rounded-3xl border border-line p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-bronze-ink font-bold">
                Kullanıcı Hesabı
              </span>
              <h1 className="text-2xl font-serif font-bold text-ink mt-1">
                Hoş Geldiniz, {user.name}
              </h1>
              <p className="text-xs text-ink-muted mt-0.5">{user.email}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleLogoutAll}
                className="text-xs font-semibold bg-surface hover:bg-line text-ink-muted px-4 py-2 rounded-xl transition-colors w-fit"
              >
                Tüm cihazlardan çıkış yap
              </button>
              <button
                onClick={handleLogout}
                className="text-xs font-semibold bg-surface hover:bg-line text-ink-muted px-4 py-2 rounded-xl transition-colors w-fit"
              >
                Çıkış Yap
              </button>
            </div>
          </div>

          <nav aria-label="Hesap bölümleri" className="-mt-4 flex flex-wrap gap-2">
            {[
              ["siparisler", "Siparişler"],
              ["adresler", "Adresler"],
              ["guvenlik", "Güvenlik"],
              ["kuponlar", "Kuponlar"],
              ["mesajlar", "Mesajlar"],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`} className="inline-flex min-h-10 items-center rounded-full border border-line-strong bg-raised px-4 text-xs font-semibold text-ink-muted hover:border-bronze-ink hover:text-bronze-ink focus-visible:outline-2 focus-visible:outline-bronze-ink">
                {label}
              </a>
            ))}
          </nav>

          <div id="siparisler" className="bg-raised rounded-3xl border border-line p-8 shadow-sm space-y-6 scroll-mt-24">
            <h2 className="text-lg font-serif font-bold text-ink border-b border-line pb-3">
              Geçmiş Siparişleriniz & Kargo Durumu
            </h2>

            {user.orders && user.orders.length > 0 ? (
              <div className="space-y-4">
                {user.orders.map((order) => (
                  <div
                    key={order.id}
                    className="border border-line rounded-2xl p-5 space-y-3 bg-surface/50"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3 text-xs">
                      <div>
                        <span className="inline-flex items-center gap-2 text-ink-muted font-mono">Sipariş Kodu: {orderCode(order.id)} <CopyCodeButton text={orderCode(order.id)} label="Sipariş kodu kopyalandı" /></span>
                        <span className="block text-[11px] text-ink-muted mt-0.5">
                          Tarih: {new Date(order.createdAt).toLocaleDateString("tr-TR")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink">
                          {order.totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            order.status === "CANCELLED" || order.status === "RETURNED"
                              ? "bg-red-100 text-red-800"
                              : order.status === "DELIVERED"
                              ? "bg-emerald-100 text-emerald-800"
                              : order.status === "READY_FOR_PICKUP"
                              ? "bg-purple-100 text-purple-800"
                              : order.status === "SHIPPED"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {order.status === "CANCELLED"
                            ? "İptal Edildi"
                            : order.status === "RETURNED"
                            ? "İade Edildi"
                            : order.status === "PENDING_NEW"
                            ? "Havale Onayı Bekleniyor"
                            : order.status === "AWAITING_PAYMENT"
                            ? "Ödeme Bekleniyor"
                            : order.status === "PAYMENT_FAILED"
                            ? "Ödeme Alınamadı"
                            : order.kargonomiStatusLabel ||
                            (order.status === "DELIVERED"
                              ? "Teslim Edildi"
                              : order.status === "READY_FOR_PICKUP"
                              ? "Mağazada Teslime Hazır"
                              : order.status === "SHIPPED"
                              ? "Kargoya Verildi"
                              : "Hazırlanıyor")}
                        </span>
                      </div>
                    </div>

                    <OrderTracker order={order} />

                    <div className="text-xs text-ink-muted space-y-3">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center gap-3">
                          <span className="flex items-center gap-2.5 min-w-0">
                            {item.variation.product && (
                              <Link
                                href={productPath(item.variation.product)}
                                aria-label={`${item.variation.product.title} ürün sayfası`}
                                className="w-16 h-16 rounded-xl bg-surface overflow-hidden shrink-0 border border-line flex items-center justify-center"
                              >
                                {item.variation.product.imageUrl && (
                                  <img src={smallImage(item.variation.product.imageUrl)} alt={item.variation.product.title} width={64} height={64} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                )}
                              </Link>
                            )}
                            <span className="min-w-0">
                              {item.quantity}x{" "}
                              {item.variation.product ? (
                                <Link href={productPath(item.variation.product)} className="font-semibold hover:text-bronze-ink hover:underline">
                                  {displayTitle(item.variation.product.title).title}
                                </Link>
                              ) : null}{" "}
                              <span className="text-ink-muted">{item.variation.variationValue}</span>
                            </span>
                          </span>
                          <span className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="font-medium text-ink">
                              {(item.quantity * item.unitPrice).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                            </span>
                            {item.variation.product && ["PENDING", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED"].includes(order.status) && (
                              <Link
                                href={`${productPath(item.variation.product)}#yorumlar`}
                                className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                ★ Yorum Yap / Fotoğraf Ekle
                              </Link>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>

                    {(() => {
                      const b = breakdownOf(order.items, order.shippingType, order.totalAmount);
                      return b.discount > 0 ? (
                        <p className="flex justify-between text-xs font-semibold text-emerald-700 border-t border-line pt-2">
                          <span>{discountLabel(order, b.itemsSum, b.discount)}</span>
                          <span className="whitespace-nowrap">-{formatTl(b.discount)}</span>
                        </p>
                      ) : null;
                    })()}

                    {order.status === "PENDING_NEW" && order.paymentMethod === "BANK_TRANSFER" && (
                      <>
                        <OrderBankBox orderId={order.id} total={order.totalAmount} createdAt={order.createdAt} receiptUploaded={Boolean(order.receiptUrl)} />
                        <ReceiptUpload orderId={order.id} uploaded={Boolean(order.receiptUrl)} amount={order.totalAmount} defaultSender={order.receiptSenderName ?? user.name} onDone={refreshUser} />
                      </>
                    )}

                    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 pt-1">
                      <OrderRequestBox order={order} onChanged={refreshUser} />
                    </div>

                    {order.status === "DELIVERED" && invoiceIds.includes(order.id) && (
                      <a
                        href={`/api/orders/${order.id}/invoice`}
                        className="inline-block text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-3 py-2 rounded-xl transition-colors"
                      >
                        🧾 Faturayı İndir (PDF)
                      </a>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-ink-muted pt-2 border-t border-line">
                      <div>
                        Teslimat:{" "}
                        <strong>
                          {order.shippingType === "BEYOGLU_MAGAZA_TESLIM"
                            ? "📍 Mağazadan Teslim (Şişhane)"
                            : `📦 Adrese Teslim ${
                                order.shippingProviderName ? `(${order.shippingProviderName})` : ""
                              }`}
                        </strong>
                        {order.shippingTrackingCode && (
                          <span className="mt-1 block">
                            <span className="text-ink-muted">Takip No: </span>
                            <CopyTrackingCode code={order.shippingTrackingCode} />
                          </span>
                        )}
                        {order.shippingType !== "BEYOGLU_MAGAZA_TESLIM" && order.address && (
                          <span className="block mt-1">Adres: {titleCaseTr(order.address)}{order.buyerCityName || order.buyerStateName ? `, ${[order.buyerCityName, order.buyerStateName].filter(Boolean).join(" / ")}` : ""}</span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <Link href={`/siparis-onay/${order.id}`} className="text-bronze-ink hover:underline font-semibold">
                          Sipariş detayı →
                        </Link>
                        {order.shippingTrackingCode && (
                          <Link
                            href={`/kargo-takip?code=${encodeURIComponent(order.shippingTrackingCode)}`}
                            className="text-bronze-ink hover:underline font-semibold"
                          >
                            🚚 Kargo Takip →
                          </Link>
                        )}
                        {(() => {
                          const t = carrierTrackingLink({ providerName: order.shippingProviderName, code: order.shippingTrackingCode });
                          return t.href && order.shippingTrackingCode ? (
                            <a href={t.href} target="_blank" rel="noopener noreferrer" className="text-orange-700 hover:underline font-semibold">
                              {t.queryLabel}
                            </a>
                          ) : null;
                        })()}
                        {(() => {
                          const t = carrierTrackingLink({ providerName: order.shippingProviderName, code: order.shippingTrackingCode });
                          return t.hint && order.shippingTrackingCode ? <span className="basis-full text-xs text-ink-muted">{t.hint}</span> : null;
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-3 text-ink-muted text-xs">
                Henüz kayıtlı bir siparişiniz bulunmuyor.
              </div>
            )}
          </div>

          <ProfileName key={user.name} name={user.name} onChanged={refreshUser} />

          <AddressBook defaultName={user.name} />

          <AccountSecurity email={user.email} twoFactorEnabled={Boolean(user.twoFactorEnabled)} onChanged={refreshUser} />

          <MyCoupons />

          <MarketingPermissions />

          <MyMessages />

          <AccountDeletion />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas py-16 px-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-raised rounded-3xl border border-line p-8 sm:p-10 shadow-sm space-y-6">
        <div role="tablist" aria-label="Giriş türü" className="flex bg-surface p-1 rounded-2xl text-xs font-semibold">
          {(["musteri", "yonetici"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2.5 rounded-xl transition-all ${
                tab === key ? "bg-raised text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {key === "musteri" ? "Müşteri Girişi" : "Yönetici Girişi"}
            </button>
          ))}
        </div>

        {tab === "yonetici" ? (
          <AdminLoginForm />
        ) : (
          <>
        <div className="text-center space-y-1">
          <span className="text-xs uppercase tracking-widest text-bronze-ink font-bold">
            Yıldırım Avize
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">
            Hesabınıza Giriş Yapın
          </h1>
          <p className="text-xs text-ink-muted">
            Siparişlerinizi ve kargo durumunuzu takip etmek için giriş yapın veya kayıt olun.
          </p>
        </div>

        <a
          href="/api/auth/google"
          className="w-full flex items-center justify-center gap-3 bg-raised hover:bg-surface border border-line-strong text-ink font-semibold py-3.5 px-4 rounded-2xl transition-all shadow-2xs hover:shadow-sm text-xs disabled:opacity-50"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Google ile Hızlı Giriş Yap</span>
        </a>

        <div className="flex items-center gap-2 sm:gap-3 my-3">
          <div aria-hidden="true" className="flex-1 min-w-0 border-t border-line" />
          <span className="shrink-0 whitespace-nowrap text-[10px] sm:text-[11px] text-ink-subtle uppercase tracking-wide sm:tracking-wider font-medium">
            veya e-posta ile
          </span>
          <div aria-hidden="true" className="flex-1 min-w-0 border-t border-line" />
        </div>

        <AuthForms
          onAuthenticated={(u) => {
            setUser(u as UserData);
          }}
        />

        <div className="text-center pt-2">
          <Link href="/" className="text-xs text-ink-muted hover:text-bronze-ink transition-colors">
            ← Alışverişe Devam Et
          </Link>
        </div>
          </>
        )}
      </div>
    </main>
  );
}
function AdminLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // 2FA açıksa şifreden sonra e-posta kodu adımı (çerez kod doğrulanana kadar verilmez)
  const [pending, setPending] = useState<{ token: string; email: string; wait: number } | null>(null);

  const call = async (body: object) => {
    const res = await fetch("/api/auth/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  };

  const verify = async (code: string) => {
    if (!pending) return;
    setLoading(true);
    setError("");
    try {
      const { ok, data } = await call({ step: "verify", username: pending.email, pendingToken: pending.token, code });
      if (!ok) throw new Error(data.error || "Kod doğrulanamadı.");
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- bilinçli tam sayfa yönlendirme (çerez)
      window.location.assign("/admin");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async (): Promise<number | null> => {
    if (!pending) return null;
    const { ok, data } = await call({ step: "resend", username: pending.email, pendingToken: pending.token }).catch(() => ({ ok: false, data: {} as Record<string, string> }));
    if (ok) return data.retryAfter ?? 60;
    setError(data.error || "Kod gönderilemedi.");
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { ok, data } = await call({ username, password });
      if (!ok) throw new Error(data.error || "Giriş başarısız.");
      if (data.twoFactor) {
        setPending({ token: data.pendingToken, email: data.username, wait: data.retryAfter ?? 60 });
        setPassword("");
        return;
      }
      // Tam sayfa yönlendirme: yeni çerez proxy tarafından ilk istekte görülür
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- bilinçli tam sayfa yönlendirme (çerez)
      window.location.assign("/admin");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="text-center space-y-1">
        <span className="text-xs uppercase tracking-widest text-bronze-ink font-bold">Yıldırım Avize</span>
        <h1 className="text-2xl font-serif font-bold text-ink">Yönetici Girişi</h1>
        <p className="text-xs text-ink-muted">Yalnızca yetkili mağaza yöneticileri içindir.</p>
      </div>
      {pending ? (
        <div className="space-y-3">
          <p className="text-xs text-ink-muted">Yönetici hesabınızda iki aşamalı doğrulama açık.</p>
          <CodeStep email={pending.email} initialWait={pending.wait} busy={loading} onSubmit={verify} onResend={resend} submitLabel="Yönetim Paneline Gir" />
          {error && (
            <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </p>
          )}
          <button type="button" onClick={() => { setPending(null); setError(""); }} className="w-full text-xs text-ink-muted hover:text-bronze-ink font-semibold py-1">
            ← Girişe dön
          </button>
        </div>
      ) : (
      <form onSubmit={submit} className="space-y-4 text-xs">
        <div>
          <label htmlFor="admin-user" className="font-semibold text-ink-muted block mb-1">E-posta veya Kullanıcı Adı</label>
          <input
            id="admin-user"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full text-base sm:text-xs p-3 rounded-xl border border-line-strong focus:border-bronze-ink focus-visible:outline-2 focus-visible:outline-bronze-ink"
          />
        </div>
        <div>
          <label htmlFor="admin-pass" className="font-semibold text-ink-muted block mb-1">Şifre</label>
          <PasswordInput
            id="admin-pass"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full text-base sm:text-xs p-3 rounded-xl border border-line-strong focus:border-bronze-ink focus-visible:outline-2 focus-visible:outline-bronze-ink"
          />
        </div>
        {error && (
          <p role="alert" className="text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-ink hover:bg-bronze-ink text-canvas font-semibold py-3.5 rounded-xl transition-colors shadow-sm disabled:opacity-50"
        >
          {loading ? "Doğrulanıyor..." : "Yönetim Paneline Gir"}
        </button>
      </form>
      )}
    </>
  );
}

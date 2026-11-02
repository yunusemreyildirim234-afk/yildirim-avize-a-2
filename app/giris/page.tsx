"use client";

import { toast } from "sonner";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MyMessages from "@/components/MyMessages";
import MyCoupons from "@/components/MyCoupons";
import OrderRequestBox from "@/components/OrderRequestBox";
import OrderTracker from "@/components/OrderTracker";
import AuthForms from "@/components/AuthForms";
import AccountSecurity from "@/components/AccountSecurity";
import ReceiptUpload from "@/components/ReceiptUpload";

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

    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => data.user && setUser(data.user))
      .catch(() => {});
  }, []);

  const refreshUser = () => {
    fetch("/api/auth/me", { cache: "no-store" })
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

  if (user) {
    return (
      <main className="min-h-screen bg-neutral-50 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-amber-600 font-bold">
                Kullanıcı Hesabı
              </span>
              <h1 className="text-2xl font-serif font-bold text-neutral-900 mt-1">
                Hoş Geldiniz, {user.name}
              </h1>
              <p className="text-xs text-neutral-500 mt-0.5">{user.email}</p>
            </div>

            <button
              onClick={handleLogout}
              className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-4 py-2 rounded-xl transition-colors w-fit"
            >
              Çıkış Yap
            </button>
          </div>

          <div id="siparisler" className="bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm space-y-6 scroll-mt-24">
            <h2 className="text-lg font-serif font-bold text-neutral-900 border-b border-neutral-100 pb-3">
              Geçmiş Siparişleriniz & Kargo Durumu
            </h2>

            {user.orders && user.orders.length > 0 ? (
              <div className="space-y-4">
                {user.orders.map((order) => (
                  <div
                    key={order.id}
                    className="border border-neutral-200 rounded-2xl p-5 space-y-3 bg-neutral-50/50"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200/80 pb-3 text-xs">
                      <div>
                        <span className="text-neutral-400 font-mono">Sipariş ID: {order.id.slice(0, 8)}...</span>
                        <span className="block text-[11px] text-neutral-500 mt-0.5">
                          Tarih: {new Date(order.createdAt).toLocaleDateString("tr-TR")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-neutral-900">
                          {order.totalAmount.toLocaleString("tr-TR")} ₺
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

                    <div className="text-xs text-neutral-700 space-y-3">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center gap-3">
                          <span className="flex items-center gap-2.5 min-w-0">
                            {item.variation.product && (
                              <Link
                                href={`/urun/${item.variation.product.id}`}
                                aria-label={`${item.variation.product.title} ürün sayfası`}
                                className="w-16 h-16 rounded-xl bg-neutral-100 overflow-hidden shrink-0 border border-neutral-200 flex items-center justify-center"
                              >
                                {item.variation.product.imageUrl && (
                                  <img src={item.variation.product.imageUrl} alt={item.variation.product.title} className="w-full h-full object-cover" />
                                )}
                              </Link>
                            )}
                            <span className="min-w-0">
                              {item.quantity}x{" "}
                              {item.variation.product ? (
                                <Link href={`/urun/${item.variation.product.id}`} className="font-semibold hover:text-amber-700 hover:underline">
                                  {item.variation.product.title}
                                </Link>
                              ) : null}{" "}
                              <span className="text-neutral-500">{item.variation.variationValue}</span>
                            </span>
                          </span>
                          <span className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="font-medium text-neutral-900">
                              {(item.quantity * item.unitPrice).toLocaleString("tr-TR")} ₺
                            </span>
                            {item.variation.product && ["PENDING", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED"].includes(order.status) && (
                              <Link
                                href={`/urun/${item.variation.product.id}#yorumlar`}
                                className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                ★ Yorum Yap / Fotoğraf Ekle
                              </Link>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>

                    {order.status === "PENDING_NEW" && order.paymentMethod === "BANK_TRANSFER" && (
                      <ReceiptUpload orderId={order.id} uploaded={Boolean(order.receiptUrl)} defaultSender={order.receiptSenderName ?? user.name} onDone={refreshUser} />
                    )}

                    <OrderRequestBox order={order} onChanged={refreshUser} />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-neutral-500 pt-2 border-t border-neutral-100">
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
                          <span className="ml-2 font-mono text-emerald-700 font-bold">
                            Takip No: {order.shippingTrackingCode}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <Link
                          href={`/kargo-takip?code=${order.shippingTrackingCode || order.id}`}
                          className="text-amber-700 hover:underline font-semibold"
                        >
                          🚚 Kargo Takip →
                        </Link>
                        {order.shippingTrackingCode && (
                          <a
                            href={`https://kargotakip.araskargo.com.tr/?kargotakipno=${encodeURIComponent(order.shippingTrackingCode)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-700 hover:underline font-semibold"
                          >
                            Aras Kargo ile Canlı Takip Et ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-neutral-400 text-xs">
                Henüz kayıtlı bir siparişiniz bulunmuyor.
              </div>
            )}
          </div>

          <AccountSecurity email={user.email} twoFactorEnabled={Boolean(user.twoFactorEnabled)} onChanged={refreshUser} />

          <MyCoupons />

          <MyMessages />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 py-16 px-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl border border-neutral-200 p-8 sm:p-10 shadow-sm space-y-6">
        <div role="tablist" aria-label="Giriş türü" className="flex bg-neutral-100 p-1 rounded-2xl text-xs font-semibold">
          {(["musteri", "yonetici"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2.5 rounded-xl transition-all ${
                tab === key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"
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
          <span className="text-xs uppercase tracking-widest text-amber-600 font-bold">
            Yıldırım Avize
          </span>
          <h1 className="text-2xl font-serif font-bold text-neutral-900">
            Hesabınıza Giriş Yapın
          </h1>
          <p className="text-xs text-neutral-500">
            Siparişlerinizi ve kargo durumunuzu takip etmek için giriş yapın veya kayıt olun.
          </p>
        </div>

        <a
          href="/api/auth/google"
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-800 font-semibold py-3.5 px-4 rounded-2xl transition-all shadow-2xs hover:shadow-sm text-xs disabled:opacity-50"
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

        <div className="relative flex items-center justify-center my-3">
          <div className="border-t border-neutral-200 w-full" />
          <span className="bg-white px-3 text-[11px] text-neutral-400 uppercase tracking-wider relative font-medium">
            veya e-posta ile
          </span>
        </div>

        <AuthForms
          onAuthenticated={(u) => {
            setUser(u as UserData);
          }}
        />

        <div className="text-center pt-2">
          <Link href="/" className="text-xs text-neutral-500 hover:text-amber-600 transition-colors">
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
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Giriş başarısız.");
      // Tam sayfa yönlendirme: yeni çerez proxy tarafından ilk istekte görülür
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
        <span className="text-xs uppercase tracking-widest text-amber-600 font-bold">Yıldırım Avize</span>
        <h1 className="text-2xl font-serif font-bold text-neutral-900">Yönetici Girişi</h1>
        <p className="text-xs text-neutral-500">Yalnızca yetkili mağaza yöneticileri içindir.</p>
      </div>
      <form onSubmit={submit} className="space-y-4 text-xs">
        <div>
          <label htmlFor="admin-user" className="font-semibold text-neutral-700 block mb-1">E-posta veya Kullanıcı Adı</label>
          <input
            id="admin-user"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600"
          />
        </div>
        <div>
          <label htmlFor="admin-pass" className="font-semibold text-neutral-700 block mb-1">Şifre</label>
          <input
            id="admin-pass"
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600"
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
          className="w-full bg-neutral-900 hover:bg-amber-600 text-white font-semibold py-3.5 rounded-xl transition-colors shadow-sm disabled:opacity-50"
        >
          {loading ? "Doğrulanıyor..." : "Yönetim Paneline Gir"}
        </button>
      </form>
    </>
  );
}

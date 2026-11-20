"use client";

import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/components/useFocusTrap";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Camera,
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Phone,
  Search,
  Shield,
  X,
  MessageSquare,
  MapPin,
  Package,
  ShoppingBag,
  Sparkles,
  Tag,
  Truck,
  User,
  Ticket,
} from "lucide-react";
import HoverMenu from "@/components/HoverMenu";
import NavSearch from "@/components/NavSearch";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { PHONE_DISPLAY, PHONE_TEL } from "@/lib/site";

const CATEGORY_LINKS = [
  { href: "/kategori/tum", label: "Tüm Ürünler" },
  { href: "/kategori/kristal", label: "Kristal Serisi" },
  { href: "/kategori/modern", label: "Modern Avizeler" },
  { href: "/kategori/klasik", label: "Klasik Koleksiyon" },
  { href: "/kategori/sarkit", label: "Sarkıt & Aplikler" },
  { href: "/kategori/aksesuar", label: "Aksesuar & Yedek Parça" },
];

const DISCOVER_LINKS = [
  { href: "/kategori/one-cikanlar", label: "Öne Çıkanlar", icon: Sparkles },
  { href: "/kategori/indirimli", label: "İndirimli Ürünler", icon: Tag },
  { href: "/musterilerimizden-gelenler", label: "Müşterilerimizden Gelenler", icon: Camera },
  { href: "/kargo-takip", label: "Kargo & Sipariş Takibi", icon: Truck },
  { href: "/iletisim", label: "Beyoğlu Mağazamız", icon: MapPin },
];

const CORPORATE_LINKS = [
  { href: "/gizlilik-politikasi", label: "Gizlilik Politikası" },
  { href: "/kullanim-sartlari", label: "Kullanım Şartları" },
  { href: "/mesafeli-satis-sozlesmesi", label: "Mesafeli Satış Sözleşmesi" },
  { href: "/iptal-iade-cayma", label: "İptal, İade ve Cayma" },
  { href: "/aydinlatma-metni", label: "KVKK Aydınlatma Metni" },
  { href: "/cerez-politikasi", label: "Çerez Politikası" },
];

const itemClass =
  "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ink-muted hover:bg-surface hover:text-ink transition-colors w-full text-left";

export default function Navbar({ extraCategories = [], fixedOverrides = {}, showGallery = true }: { extraCategories?: { href: string; label: string }[]; fixedOverrides?: Record<string, { title?: string; hidden?: boolean }>; showGallery?: boolean }) {
  // Yayınlanmış müşteri fotoğrafı yokken "Müşterilerimizden Gelenler" menüde görünmez
  const discoverLinks = DISCOVER_LINKS.filter((l) => showGallery || l.href !== "/musterilerimizden-gelenler");
  // Sabit bağlantılar aynen (yönetici görünen adı değiştirdiyse yeni ad, gizlediyse menüde yok); sonradan eklenen koleksiyonlar arkasına (masaüstü menü, mobil şerit ve çekmece aynı listeyi kullanır)
  const categoryLinks = [
    ...CATEGORY_LINKS.filter((l) => !fixedOverrides[l.href.split("/").pop() ?? ""]?.hidden).map((l) => ({ ...l, label: fixedOverrides[l.href.split("/").pop() ?? ""]?.title ?? l.label })),
    ...extraCategories,
  ];
  const { totalItems } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const { user, admin, clear } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Sayfa değişince çekmeceyi kapat
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rota değişiminde çekmece sıfırlanır
    setDrawerOpen(false);
  }, [pathname]);

  // Çekmece açıkken sayfa kaydırması kilitlenir
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);
  // Esc, Tab döngüsü ve kapanınca odağın hamburger düğmesine dönmesi
  useFocusTrap(drawerOpen, drawerRef, { onEscape: () => setDrawerOpen(false) });

  const logout = async (close: () => void) => {
    close();
    await fetch("/api/auth/logout", { method: "POST" });
    clear();
    window.dispatchEvent(new Event("ya-auth"));
    router.push("/");
    router.refresh();
  };

  const initial = user?.name?.trim().charAt(0).toUpperCase();

  return (
    <header className="w-full bg-canvas border-b border-line sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
        {/* SOL: Logo + Koleksiyonlar menüsü */}
        <div className="flex items-center gap-1 sm:gap-3 min-w-0">
          <button
            type="button"
            aria-label="Menüyü aç"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="md:hidden -ml-2 rounded-full p-2 hover:bg-surface transition-colors"
          >
            <Menu aria-hidden="true" className="w-6 h-6 text-ink" />
          </button>
          <Link href="/" aria-label="Yıldırım Avize ana sayfa" className="shrink-0 flex items-center gap-2.5">
            <Image
              src="/logo-header-8.png"
              alt="Yıldırım Avize logosu"
              width={86}
              height={40}
              priority
              className="h-10 sm:h-11 w-auto"
            />
            <span className="hidden md:block whitespace-nowrap font-serif font-black text-2xl tracking-tight text-ink leading-none">
              Yıldırım Avize
            </span>
          </Link>

          <div className="hidden md:block">
          <HoverMenu
            label="Koleksiyonlar menüsünü aç"
            panelClassName="w-72"
            trigger={(open) => (
              <>
                <span className="text-sm font-semibold text-ink">Koleksiyonlar</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`w-4 h-4 text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
                />
              </>
            )}
          >
            {(close) => (
              <div className="p-1">
                <h2 className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Keşfet</h2>
                {discoverLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} role="menuitem" onClick={close} className={itemClass}>
                    <Icon aria-hidden="true" className="w-4 h-4 text-bronze-ink shrink-0" />
                    {label}
                  </Link>
                ))}
                <div className="border-t border-line mt-1 pt-1">
                  <Link href="/kategori/tum" role="menuitem" onClick={close} className={`${itemClass} font-semibold text-ink`}>
                    Tüm koleksiyonlar
                  </Link>
                </div>
              </div>
            )}
          </HoverMenu>
          </div>
        </div>

        {/* SAĞ: Sepet + Hesabım + Avatar menüsü */}
        <div className="flex items-center gap-0 sm:gap-2 shrink-0">
          <NavSearch />
          <Link
            href="/sepet"
            aria-label={`Sepetim, ${totalItems} ürün`}
            className="relative flex items-center gap-2 rounded-full p-2 sm:px-3 sm:py-2 hover:bg-surface transition-colors"
          >
            <ShoppingBag aria-hidden="true" className="w-5 h-5 text-ink" />
            <span className="hidden sm:inline text-sm font-semibold text-ink">Sepet</span>
            {totalItems > 0 && (
              <span className="absolute -top-0.5 left-6 sm:left-7 min-w-5 h-5 px-1 rounded-full bg-bronze-ink text-[11px] font-bold text-on-bronze flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Link>

          {(user || admin) && <NotificationBell />}

          <ThemeToggle />

          <Link
            href="/giris"
            className="hidden md:inline-block rounded-full px-3 py-2 text-sm font-semibold text-ink hover:bg-surface transition-colors"
          >
            Hesabım
          </Link>

          <HoverMenu
            label="Hesap menüsünü aç"
            align="right"
            panelClassName="w-60"
            trigger={(open) => (
              <>
                <span className="w-9 h-9 rounded-full border border-line bg-surface overflow-hidden flex items-center justify-center text-sm font-bold text-ink-muted">
                  {user?.picture ? (
                    <Image src={user.picture} alt="Profil fotoğrafı" width={36} height={36} className="w-full h-full object-cover" />
                  ) : initial ? (
                    initial
                  ) : (
                    <User aria-hidden="true" className="w-5 h-5 text-ink-subtle" />
                  )}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`hidden sm:block w-4 h-4 text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
                />
              </>
            )}
          >
            {(close) => (
              <div className="space-y-0.5">
                {user && (
                  <div className="px-3 py-2 mb-1 border-b border-line">
                    <p className="text-sm font-semibold text-ink truncate">{user.name}</p>
                    <p className="text-xs text-ink-subtle truncate">{user.email}</p>
                  </div>
                )}
                <Link href="/giris" role="menuitem" onClick={close} className={itemClass}>
                  <User aria-hidden="true" className="w-4 h-4 text-ink-subtle" /> Profilim
                </Link>
                <Link href="/giris#siparisler" role="menuitem" onClick={close} className={itemClass}>
                  <Package aria-hidden="true" className="w-4 h-4 text-ink-subtle" /> Siparişlerim
                </Link>
                <Link href="/giris#adresler" role="menuitem" onClick={close} className={itemClass}>
                  <MapPin aria-hidden="true" className="w-4 h-4 text-ink-subtle" /> Adreslerim
                </Link>
                <Link href="/favorilerim" role="menuitem" onClick={close} className={itemClass}>
                  <Heart aria-hidden="true" className="w-4 h-4 text-ink-subtle" /> Favorilerim
                </Link>
                <Link href="/giris#kuponlar" role="menuitem" onClick={close} className={itemClass}>
                  <Ticket aria-hidden="true" className="w-4 h-4 text-ink-subtle" /> Kuponlarım
                </Link>
                <Link href="/giris#mesajlar" role="menuitem" onClick={close} className={itemClass}>
                  <MessageSquare aria-hidden="true" className="w-4 h-4 text-ink-subtle" /> Sorularım / Mesajlarım
                </Link>
                <Link href="/kargo-takip" role="menuitem" onClick={close} className={itemClass}>
                  <Truck aria-hidden="true" className="w-4 h-4 text-ink-subtle" /> Kargo Takip
                </Link>
                {admin && (
                  <Link href="/admin" role="menuitem" onClick={close} className={`${itemClass} text-bronze-ink font-semibold`}>
                    <LayoutDashboard aria-hidden="true" className="w-4 h-4" /> Yönetim Paneli
                  </Link>
                )}
                <div className="border-t border-line mt-1 pt-1">
                  {user || admin ? (
                    <button type="button" role="menuitem" onClick={() => logout(close)} className={itemClass}>
                      <LogOut aria-hidden="true" className="w-4 h-4 text-ink-subtle" /> Çıkış Yap
                    </button>
                  ) : (
                    <Link href="/giris" role="menuitem" onClick={close} className={itemClass}>
                      <LogIn aria-hidden="true" className="w-4 h-4 text-ink-subtle" /> Giriş Yap
                    </Link>
                  )}
                </div>
              </div>
            )}
          </HoverMenu>
        </div>
      </div>

      {/* Masaüstü: ince ikinci satır, kategori bağlantıları */}
      <nav aria-label="Kategoriler" className="hidden md:block border-t border-line">
        <ul className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-x-7 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categoryLinks.map((l) => {
            const active = pathname === l.href;
            return (
              <li key={l.href} className="shrink-0">
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`block py-3 text-[11px] font-semibold uppercase tracking-[0.14em] border-b-2 transition-colors hover:text-ink hover:border-bronze ${
                    active ? "text-ink border-bronze" : "text-ink-muted border-transparent"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobil: kaydırılabilir koleksiyon hapları */}
      <nav aria-label="Koleksiyonlar" className="md:hidden border-t border-line flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categoryLinks.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                active ? "bg-ink border-ink text-canvas" : "bg-raised border-line text-ink-muted hover:bg-surface"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobil: hamburger çekmecesi */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menü">
          <button type="button" aria-label="Menüyü kapat" onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-night/50" />
          <div ref={drawerRef} className="absolute left-0 top-0 bottom-0 w-[85vw] max-w-sm bg-canvas shadow-2xl flex flex-col">
            <div className="flex items-center justify-between h-16 px-4 border-b border-line shrink-0">
              <span className="font-serif font-black text-xl tracking-tight text-ink">
                Yıldırım Avize
              </span>
              <button type="button" aria-label="Menüyü kapat" onClick={() => setDrawerOpen(false)} className="rounded-full p-2 hover:bg-surface">
                <X aria-hidden="true" className="w-5 h-5 text-ink-muted" />
              </button>
            </div>
            <form action="/arama" method="get" role="search" className="px-4 py-3 border-b border-line shrink-0">
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
                <input
                  type="search"
                  name="q"
                  maxLength={100}
                  enterKeyHint="search"
                  autoComplete="off"
                  aria-label="Çekmecede ürün ara"
                  placeholder="Ürün adı veya model kodu"
                  className="w-full rounded-full border border-line-strong bg-raised pl-9 pr-3 py-2.5 text-base text-ink placeholder:text-ink-subtle focus:outline-none focus:border-bronze-ink focus:ring-2 focus:ring-bronze/20"
                />
              </div>
            </form>
            <div className="flex-1 overflow-y-auto p-3 space-y-5">
              <div>
                <h2 className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Koleksiyonlar</h2>
                {categoryLinks.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setDrawerOpen(false)} className={itemClass}>
                    {l.label}
                  </Link>
                ))}
              </div>
              <div>
                <h2 className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Keşfet</h2>
                {discoverLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} onClick={() => setDrawerOpen(false)} className={itemClass}>
                    <Icon aria-hidden="true" className="w-4 h-4 text-bronze-ink shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
              <div>
                <h2 className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Kurumsal</h2>
                {CORPORATE_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setDrawerOpen(false)} className={itemClass}>
                    <Shield aria-hidden="true" className="w-4 h-4 text-ink-subtle shrink-0" />
                    {l.label}
                  </Link>
                ))}
              </div>
              <div>
                <h2 className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">İletişim</h2>
                <Link href="/iletisim" onClick={() => setDrawerOpen(false)} className={itemClass}>
                  <MessageSquare aria-hidden="true" className="w-4 h-4 text-ink-subtle shrink-0" /> Bize Ulaşın
                </Link>
                <a href={`tel:${PHONE_TEL}`} className={itemClass}>
                  <Phone aria-hidden="true" className="w-4 h-4 text-ink-subtle shrink-0" /> {PHONE_DISPLAY}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

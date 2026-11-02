"use client";

import { useEffect, useState } from "react";
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
import { PHONE_DISPLAY, PHONE_TEL } from "@/lib/site";

interface Session {
  user: { name: string; email: string; picture?: string | null } | null;
  admin: boolean;
}

const CATEGORY_LINKS = [
  { href: "/kategori/tum", label: "Tüm Ürünler" },
  { href: "/kategori/kristal", label: "Kristal Serisi" },
  { href: "/kategori/modern", label: "Modern Avizeler" },
  { href: "/kategori/klasik", label: "Klasik Koleksiyon" },
  { href: "/kategori/sarkit", label: "Sarkıt & Aplikler" },
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
];

const itemClass =
  "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors w-full text-left";

export default function Navbar() {
  const { totalItems } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session>({ user: null, admin: false });
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Sayfa değişince çekmeceyi kapat
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rota değişiminde çekmece sıfırlanır
    setDrawerOpen(false);
  }, [pathname]);

  // Çekmece açıkken ESC ile kapanır ve sayfa kaydırması kilitlenir
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/auth/me")
        .then((res) => res.json())
        .then((data: Session) => active && setSession({ user: data.user, admin: data.admin }))
        .catch(() => {});
    load();
    window.addEventListener("ya-auth", load);
    return () => {
      active = false;
      window.removeEventListener("ya-auth", load);
    };
  }, [pathname]);

  const logout = async (close: () => void) => {
    close();
    await fetch("/api/auth/logout", { method: "POST" });
    setSession({ user: null, admin: false });
    window.dispatchEvent(new Event("ya-auth"));
    router.push("/");
    router.refresh();
  };

  const { user, admin } = session;
  const initial = user?.name?.trim().charAt(0).toUpperCase();

  return (
    <header className="w-full bg-white border-b border-zinc-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
        {/* SOL: Logo + Koleksiyonlar menüsü */}
        <div className="flex items-center gap-1 sm:gap-3 min-w-0">
          <button
            type="button"
            aria-label="Menüyü aç"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="md:hidden -ml-2 rounded-full p-2 hover:bg-zinc-100 transition-colors"
          >
            <Menu aria-hidden="true" className="w-6 h-6 text-zinc-800" />
          </button>
          <Link href="/" aria-label="Yıldırım Avize ana sayfa" className="shrink-0 flex items-center gap-2.5">
            <Image
              src="/logo-mark.png"
              alt="Yıldırım Avize logosu"
              width={480}
              height={327}
              priority
              className="h-9 sm:h-10 w-auto"
            />
            <span className="hidden md:block font-serif font-bold text-lg tracking-wide text-zinc-900 leading-none">
              Yıldırım <span className="text-red-700">Avize</span>
            </span>
          </Link>

          <div className="hidden md:block">
          <HoverMenu
            label="Koleksiyonlar menüsünü aç"
            panelClassName="w-[min(92vw,34rem)]"
            trigger={(open) => (
              <>
                <span className="text-sm font-semibold text-zinc-800">Koleksiyonlar</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`w-4 h-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </>
            )}
          >
            {(close) => (
              <div className="grid grid-cols-2 gap-4 p-1">
                <div>
                  <h2 className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Kategoriler</h2>
                  {CATEGORY_LINKS.map((l) => (
                    <Link key={l.href} href={l.href} role="menuitem" onClick={close} className={itemClass}>
                      {l.label}
                    </Link>
                  ))}
                </div>
                <div className="border-l border-zinc-100 pl-4">
                  <h2 className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Keşfet</h2>
                  {DISCOVER_LINKS.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href} role="menuitem" onClick={close} className={itemClass}>
                      <Icon aria-hidden="true" className="w-4 h-4 text-amber-600 shrink-0" />
                      {label}
                    </Link>
                  ))}
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
            className="relative flex items-center gap-2 rounded-full p-2 sm:px-3 sm:py-2 hover:bg-zinc-100 transition-colors"
          >
            <ShoppingBag aria-hidden="true" className="w-5 h-5 text-zinc-800" />
            <span className="hidden sm:inline text-sm font-semibold text-zinc-800">Sepet</span>
            {totalItems > 0 && (
              <span className="absolute -top-0.5 left-6 sm:left-7 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-[11px] font-bold text-zinc-950 flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Link>

          {(user || admin) && <NotificationBell />}

          <ThemeToggle />

          <Link
            href="/giris"
            className="hidden md:inline-block rounded-full px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 transition-colors"
          >
            Hesabım
          </Link>

          <HoverMenu
            label="Hesap menüsünü aç"
            align="right"
            panelClassName="w-60"
            trigger={(open) => (
              <>
                <span className="w-9 h-9 rounded-full border border-zinc-200 bg-zinc-100 overflow-hidden flex items-center justify-center text-sm font-bold text-zinc-700">
                  {user?.picture ? (
                    <Image src={user.picture} alt="Profil fotoğrafı" width={36} height={36} className="w-full h-full object-cover" />
                  ) : initial ? (
                    initial
                  ) : (
                    <User aria-hidden="true" className="w-5 h-5 text-zinc-500" />
                  )}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`hidden sm:block w-4 h-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </>
            )}
          >
            {(close) => (
              <div className="space-y-0.5">
                {user && (
                  <div className="px-3 py-2 mb-1 border-b border-zinc-100">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{user.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                  </div>
                )}
                <Link href="/giris" role="menuitem" onClick={close} className={itemClass}>
                  <User aria-hidden="true" className="w-4 h-4 text-zinc-500" /> Profilim
                </Link>
                <Link href="/giris#siparisler" role="menuitem" onClick={close} className={itemClass}>
                  <Package aria-hidden="true" className="w-4 h-4 text-zinc-500" /> Siparişlerim
                </Link>
                <Link href="/favorilerim" role="menuitem" onClick={close} className={itemClass}>
                  <Heart aria-hidden="true" className="w-4 h-4 text-zinc-500" /> Favorilerim
                </Link>
                <Link href="/giris#kuponlar" role="menuitem" onClick={close} className={itemClass}>
                  <Ticket aria-hidden="true" className="w-4 h-4 text-zinc-500" /> Kuponlarım
                </Link>
                <Link href="/giris#mesajlar" role="menuitem" onClick={close} className={itemClass}>
                  <MessageSquare aria-hidden="true" className="w-4 h-4 text-zinc-500" /> Sorularım / Mesajlarım
                </Link>
                <Link href="/kargo-takip" role="menuitem" onClick={close} className={itemClass}>
                  <Truck aria-hidden="true" className="w-4 h-4 text-zinc-500" /> Kargo Takip
                </Link>
                {admin && (
                  <Link href="/admin" role="menuitem" onClick={close} className={`${itemClass} text-amber-700 font-semibold`}>
                    <LayoutDashboard aria-hidden="true" className="w-4 h-4" /> Yönetim Paneli
                  </Link>
                )}
                <div className="border-t border-zinc-100 mt-1 pt-1">
                  {user || admin ? (
                    <button type="button" role="menuitem" onClick={() => logout(close)} className={itemClass}>
                      <LogOut aria-hidden="true" className="w-4 h-4 text-zinc-500" /> Çıkış Yap
                    </button>
                  ) : (
                    <Link href="/giris" role="menuitem" onClick={close} className={itemClass}>
                      <LogIn aria-hidden="true" className="w-4 h-4 text-zinc-500" /> Giriş Yap
                    </Link>
                  )}
                </div>
              </div>
            )}
          </HoverMenu>
        </div>
      </div>

      {/* Mobil: kaydırılabilir koleksiyon hapları */}
      <nav aria-label="Koleksiyonlar" className="md:hidden border-t border-zinc-100 flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORY_LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                active ? "bg-amber-600 border-amber-600 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100"
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
          <button type="button" aria-label="Menüyü kapat" onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-zinc-950/50" />
          <div className="absolute left-0 top-0 bottom-0 w-[85vw] max-w-sm bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-100 shrink-0">
              <span className="font-serif font-bold text-lg text-zinc-900">
                Yıldırım <span className="text-red-700">Avize</span>
              </span>
              <button type="button" aria-label="Menüyü kapat" onClick={() => setDrawerOpen(false)} className="rounded-full p-2 hover:bg-zinc-100">
                <X aria-hidden="true" className="w-5 h-5 text-zinc-700" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-5">
              <div>
                <h2 className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Koleksiyonlar</h2>
                {CATEGORY_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setDrawerOpen(false)} className={itemClass}>
                    {l.label}
                  </Link>
                ))}
              </div>
              <div>
                <h2 className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Keşfet</h2>
                {DISCOVER_LINKS.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} onClick={() => setDrawerOpen(false)} className={itemClass}>
                    <Icon aria-hidden="true" className="w-4 h-4 text-amber-600 shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
              <div>
                <h2 className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Kurumsal</h2>
                {CORPORATE_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setDrawerOpen(false)} className={itemClass}>
                    <Shield aria-hidden="true" className="w-4 h-4 text-zinc-400 shrink-0" />
                    {l.label}
                  </Link>
                ))}
              </div>
              <div>
                <h2 className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">İletişim</h2>
                <Link href="/iletisim" onClick={() => setDrawerOpen(false)} className={itemClass}>
                  <MessageSquare aria-hidden="true" className="w-4 h-4 text-zinc-500 shrink-0" /> Bize Ulaşın
                </Link>
                <a href={`tel:${PHONE_TEL}`} className={itemClass}>
                  <Phone aria-hidden="true" className="w-4 h-4 text-zinc-500 shrink-0" /> {PHONE_DISPLAY}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

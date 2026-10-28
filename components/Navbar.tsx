"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPin,
  Package,
  ShoppingBag,
  Sparkles,
  Tag,
  Truck,
  User,
} from "lucide-react";
import HoverMenu from "@/components/HoverMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { useCart } from "@/context/CartContext";

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
  { href: "/kargo-takip", label: "Kargo & Sipariş Takibi", icon: Truck },
  { href: "/iletisim", label: "Beyoğlu Mağazamız", icon: MapPin },
];

const itemClass =
  "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors w-full text-left";

export default function Navbar() {
  const { totalItems } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session>({ user: null, admin: false });

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
    router.push("/");
    router.refresh();
  };

  const { user, admin } = session;
  const initial = user?.name?.trim().charAt(0).toUpperCase();

  return (
    <header className="w-full bg-white/95 backdrop-blur border-b border-zinc-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
        {/* SOL: Logo + Koleksiyonlar menüsü */}
        <div className="flex items-center gap-1 sm:gap-3">
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

        {/* SAĞ: Sepet + Hesabım + Avatar menüsü */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/sepet"
            aria-label={`Sepetim, ${totalItems} ürün`}
            className="relative flex items-center gap-2 rounded-full px-3 py-2 hover:bg-zinc-100 transition-colors"
          >
            <ShoppingBag aria-hidden="true" className="w-5 h-5 text-zinc-800" />
            <span className="hidden sm:inline text-sm font-semibold text-zinc-800">Sepet</span>
            {totalItems > 0 && (
              <span className="absolute -top-0.5 left-6 sm:left-7 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-[11px] font-bold text-zinc-950 flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Link>

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
                  className={`w-4 h-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
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
    </header>
  );
}

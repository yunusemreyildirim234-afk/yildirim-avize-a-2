import Link from "next/link";
import CompanyInfo from "@/components/CompanyInfo";
import { ADDRESS_LINE, CATEGORIES, MAP_EMBED_SRC, MAP_LINK, PHONE_DISPLAY, PHONE_TEL } from "@/lib/site";

const MAP_SRC = MAP_EMBED_SRC;
const DIRECTIONS = MAP_LINK;

const CHANNELS = [
  { label: "Instagram (@yildirimavize)", href: "https://www.instagram.com/yildirimavize/", icon: "📸", highlight: false },
  { label: "Facebook Sayfamız", href: "https://www.facebook.com/y.ld.r.m.avize/", icon: "📘", highlight: false },
  { label: "Hepsiburada Mağazamız", href: "https://www.hepsiburada.com/magaza/yildirim-avize", icon: "🛒", highlight: true },
  { label: "Trendyol Mağazamız", href: "https://www.trendyol.com/magaza/yildirimavize-m-379320?sst=0", icon: "🛒", highlight: true },
];

export default function Footer({ extraCategories = [], fixedOverrides = {} }: { extraCategories?: { href: string; label: string }[]; fixedOverrides?: Record<string, { title?: string; hidden?: boolean }> }) {
  return (
    <footer className="keep-theme bg-zinc-950 text-white pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-zinc-800">
        <div className="space-y-4 md:col-span-2">
          <span className="text-2xl font-serif font-bold tracking-wider text-neutral-100">
            YILDIRIM <span className="text-amber-500 font-sans font-light">AVİZE</span>
          </span>
          <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
            Beyoğlu Şişhane&apos;nin asırlık aydınlatma kültürünü, el işçiliği kristal avizeler ve modern mimari
            tasarımlarla evinize taşıyoruz.
          </p>
          <address className="not-italic text-xs text-neutral-400 space-y-1">
            <p className="text-amber-400 font-medium">📍 {ADDRESS_LINE}</p>
            <p>
              📞{" "}
              <a href={`tel:${PHONE_TEL}`} className="inline-block py-1 hover:text-amber-400 font-mono">
                {PHONE_DISPLAY}
              </a>
            </p>
            <p className="text-[11px] text-neutral-400 pt-1">
              🕒 Hafta İçi (Pzt - Cuma): 09:00 - 18:00 | Hafta Sonu: Kapalı
            </p>
          </address>
          <iframe
            title="Yıldırım Avize Beyoğlu Şişhane mağaza konumu - Google Harita"
            src={MAP_SRC}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-48 rounded-2xl border border-zinc-800 grayscale-[40%] hover:grayscale-0 transition"
          />
          <a
            href={DIRECTIONS}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-semibold text-amber-400 hover:text-amber-300"
          >
            Yol Tarifi Al →
          </a>
        </div>

        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-100 mb-1">Koleksiyonlar</h2>
          <ul className="text-xs text-neutral-400 space-y-1">
            {CATEGORIES.filter((c) => !fixedOverrides[c.slug]?.hidden).map((c) => (
              <li key={c.slug}>
                <Link href={`/kategori/${c.slug}`} className="inline-block py-1.5 hover:text-amber-400">
                  {fixedOverrides[c.slug]?.title ?? c.title}
                </Link>
              </li>
            ))}
            {extraCategories.map((c) => (
              <li key={c.href}>
                <Link href={c.href} className="inline-block py-1.5 hover:text-amber-400">
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-100 mb-1">Resmi Kanallarımız</h2>
          <ul className="text-xs text-neutral-400 space-y-1">
            {CHANNELS.map((c) => (
              <li key={c.href}>
                <a
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`transition-colors flex items-center gap-1.5 py-1.5 ${
                    c.highlight ? "text-amber-400 hover:text-amber-300 font-semibold" : "hover:text-amber-400"
                  }`}
                >
                  <span aria-hidden="true">{c.icon}</span>
                  <span>{c.label}</span>
                </a>
              </li>
            ))}
            <li className="pt-2 border-t border-zinc-800">
              <Link href="/iletisim" className="block py-1.5 hover:text-amber-400 transition-colors">
                Mağaza Yol Tarifi & İletişim
              </Link>
            </li>
            <li>
              <Link href="/musterilerimizden-gelenler" className="block py-1.5 hover:text-amber-400 transition-colors">
                Müşterilerimizden Gelenler
              </Link>
            </li>
            <li>
              <Link href="/kargo-takip" className="block py-1.5 hover:text-amber-400 transition-colors">
                Kargo & Sipariş Takibi
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <CompanyInfo variant="dark" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex flex-col md:flex-row items-center justify-between text-[11px] text-neutral-400 gap-4">
        <p>© 2026 Yıldırım Avize. Tüm hakları saklıdır.</p>
        <nav aria-label="Yasal bağlantılar" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/gizlilik-politikasi" className="inline-block py-1 hover:text-neutral-200">
            Gizlilik Politikası
          </Link>
          <Link href="/kullanim-sartlari" className="inline-block py-1 hover:text-neutral-200">
            Kullanım Şartları
          </Link>
          <Link href="/mesafeli-satis-sozlesmesi" className="inline-block py-1 hover:text-neutral-200">
            Mesafeli Satış Sözleşmesi
          </Link>
          <Link href="/iptal-iade-cayma" className="inline-block py-1 hover:text-neutral-200">
            İptal, İade ve Cayma
          </Link>
          <Link href="/aydinlatma-metni" className="inline-block py-1 hover:text-neutral-200">
            KVKK Aydınlatma Metni
          </Link>
          <Link href="/cerez-politikasi" className="inline-block py-1 hover:text-neutral-200">
            Çerez Politikası
          </Link>
        </nav>
      </div>
    </footer>
  );
}

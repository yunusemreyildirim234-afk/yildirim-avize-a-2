import Link from "next/link";
import CompanyInfo from "@/components/CompanyInfo";
import FooterMap from "@/components/FooterMap";
import { AvantajlarAcLink } from "@/components/PromoStripClient";
import { ADDRESS_LINE, CATEGORIES, MAP_EMBED_SRC, MAP_LINK, PHONE_DISPLAY, PHONE_TEL, SOCIAL_LINKS } from "@/lib/site";

const MAP_SRC = MAP_EMBED_SRC;
const DIRECTIONS = MAP_LINK;

const CHANNELS = [
  { label: "Instagram (@yildirimavize)", href: SOCIAL_LINKS.instagram, icon: "📸", highlight: false },
  { label: "TikTok (@yildirimavizecomtr)", href: SOCIAL_LINKS.tiktok, icon: "🎵", highlight: false },
  { label: "YouTube (Yıldırım Avize)", href: SOCIAL_LINKS.youtube, icon: "▶️", highlight: false },
  { label: "Facebook Sayfamız", href: SOCIAL_LINKS.facebook, icon: "📘", highlight: false },
  { label: "Trendyol Mağazamız", href: SOCIAL_LINKS.trendyol, icon: "🛒", highlight: true },
  { label: "Hepsiburada Mağazamız", href: SOCIAL_LINKS.hepsiburada, icon: "🛒", highlight: true },
];

export default function Footer({ extraCategories = [], fixedOverrides = {}, showGallery = true }: { extraCategories?: { href: string; label: string }[]; fixedOverrides?: Record<string, { title?: string; hidden?: boolean }>; showGallery?: boolean }) {
  return (
    <footer className="keep-theme bg-night text-white border-t-2 border-bronze-soft/50 pt-16 pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-zinc-800">
        <div className="space-y-4 md:col-span-2">
          <span className="text-2xl font-serif font-bold tracking-wider text-neutral-100">
            YILDIRIM <span className="text-bronze-soft font-sans font-light">AVİZE</span>
          </span>
          <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
            Beyoğlu Şişhane&apos;nin asırlık aydınlatma kültürünü, el işçiliği kristal avizeler ve modern mimari
            tasarımlarla evinize taşıyoruz.
          </p>
          <address className="not-italic text-xs text-neutral-400 space-y-1">
            <p className="text-bronze-soft font-medium">📍 {ADDRESS_LINE}</p>
            <p>
              📞{" "}
              <a href={`tel:${PHONE_TEL}`} className="inline-block py-1 hover:text-bronze-soft font-mono">
                {PHONE_DISPLAY}
              </a>
            </p>
            <p className="text-[11px] text-neutral-400 pt-1">
              🕒 Hafta İçi (Pzt - Cuma): 09:00 - 18:00 | Hafta Sonu: Kapalı
            </p>
          </address>
          <FooterMap title="Yıldırım Avize Beyoğlu Şişhane mağaza konumu - Google Harita" src={MAP_SRC} />
          <a
            href={DIRECTIONS}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-semibold text-bronze-soft hover:text-neutral-100"
          >
            Yol Tarifi Al →
          </a>
        </div>

        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-100 mb-1">Koleksiyonlar</h2>
          <ul className="text-xs text-neutral-400 space-y-1">
            {CATEGORIES.filter((c) => !fixedOverrides[c.slug]?.hidden).map((c) => (
              <li key={c.slug}>
                <Link href={`/kategori/${c.slug}`} className="inline-block py-1.5 hover:text-bronze-soft">
                  {fixedOverrides[c.slug]?.title ?? c.title}
                </Link>
              </li>
            ))}
            {extraCategories.map((c) => (
              <li key={c.href}>
                <Link href={c.href} className="inline-block py-1.5 hover:text-bronze-soft">
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
                    c.highlight ? "text-bronze-soft hover:text-neutral-100 font-semibold" : "hover:text-bronze-soft"
                  }`}
                >
                  <span aria-hidden="true">{c.icon}</span>
                  <span>{c.label}</span>
                </a>
              </li>
            ))}
            <li className="pt-2 border-t border-zinc-800">
              <Link href="/iletisim" className="block py-1.5 hover:text-bronze-soft transition-colors">
                Mağaza Yol Tarifi & İletişim
              </Link>
            </li>
            {showGallery && (
              <li>
                <Link href="/musterilerimizden-gelenler" className="block py-1.5 hover:text-bronze-soft transition-colors">
                  Müşterilerimizden Gelenler
                </Link>
              </li>
            )}
            <li>
              <Link href="/kargo-takip" className="block py-1.5 hover:text-bronze-soft transition-colors">
                Kargo & Sipariş Takibi
              </Link>
            </li>
            <li>
              <Link href="/#sss-baslik" className="block py-1.5 hover:text-bronze-soft transition-colors">
                Sık Sorulan Sorular
              </Link>
            </li>
            <li>
              <AvantajlarAcLink className="block py-1.5 text-left hover:text-bronze-soft transition-colors" />
            </li>
          </ul>
        </div>
      </div>

      <CompanyInfo variant="dark" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20 sm:pb-6 md:pr-24 flex flex-col md:flex-row items-center justify-between text-[11px] text-neutral-400 gap-4">
        <p>© {new Date().getFullYear()} Yıldırım Avize. Tüm hakları saklıdır.</p>
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

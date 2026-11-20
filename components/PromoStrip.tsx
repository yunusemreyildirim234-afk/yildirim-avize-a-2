import Link from "next/link";
import { Landmark, MapPin, Sparkles, Tag, Truck, type LucideIcon } from "lucide-react";
import { CopyCode, DismissibleStrip } from "@/components/PromoStripClient";
import { avantajSurumu } from "@/lib/promo-dismiss";
import { getPromoViews } from "@/lib/promo-data";
import { getLadderContext } from "@/lib/showcase";
import { BANK_TRANSFER_DISCOUNT } from "@/lib/pricing";
import type { PromoKind, PromoView } from "@/lib/promo-cards";

const ICONS: Record<PromoKind | "HAVALE", LucideIcon> = { COUPON: Tag, SHIPPING: Truck, PICKUP: MapPin, TEXT: Sparkles, HAVALE: Landmark };
// Şerit sırası: kupon, kargo, mağaza, (Havale), serbest metin. Aynı türde admin sırası korunur.
const ORDER: Record<PromoKind, number> = { COUPON: 0, SHIPPING: 1, PICKUP: 2, TEXT: 4 };
const HAVALE_ORDER = 3;
const HAVALE_RE = /havale|\beft\b/i;

type Item = { id: string; icon: LucideIcon; title: string; text: string; code?: string; link?: { label: string; href: string } };

function toItem(v: PromoView): Item {
  const base = { id: v.id, icon: ICONS[v.kind], title: v.title, text: v.text, ...(v.code ? { code: v.code } : {}) };
  if (v.kind === "SHIPPING") return { ...base, link: { label: "Aras Kargo · canlı takip", href: "/kargo-takip" } };
  if (v.kind === "PICKUP") return { ...base, link: { label: "Beyoğlu Şişhane", href: "/iletisim" } };
  if (v.kind === "TEXT" && v.href) return { ...base, link: { label: "Detaylar", href: v.href } };
  return base;
}

const linkCls = "inline-flex items-center min-h-6 text-xs font-medium text-bronze-ink underline underline-offset-2 hover:text-bronze-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink";

function Cell({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <li className="flex items-start gap-3 min-w-0">
      <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-surface text-bronze-ink">
        <Icon aria-hidden="true" className="w-4 h-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-ink leading-snug">{item.title}</h3>
        <p className="mt-0.5 text-xs text-ink-muted leading-snug line-clamp-2">{item.text}</p>
        {item.code && (
          <div className="mt-1.5">
            <CopyCode
              code={item.code}
              codeClass="bg-surface text-ink"
              buttonClass="border border-line-strong text-ink hover:bg-surface"
            />
          </div>
        )}
        {item.link &&
          (item.link.href.startsWith("/") ? (
            <Link href={item.link.href} className={linkCls}>
              {item.link.label}
            </Link>
          ) : (
            <a href={item.link.href} target="_blank" rel="noopener noreferrer" className={linkCls}>
              {item.link.label}
            </a>
          ))}
      </div>
    </li>
  );
}

/** Hero'nun altındaki "Avantajlar" güven şeridi. Sunucu bileşeni; yalnızca kopyala ve gizle düğmeleri istemci adasıdır. Yönetici kart bırakmadıysa hiçbir şey çizilmez. */
export default async function PromoStrip() {
  const views = await getPromoViews();
  if (views.length === 0) return null;
  const surum = avantajSurumu(views);
  const ctx = await getLadderContext();

  const ranked: { order: number; item: Item }[] = views.map((v) => ({ order: ORDER[v.kind], item: toItem(v) }));
  // Havale/EFT: toplam indirim üst sınırı 0 ise (ek indirim yok) indirim vaat eden öğe gösterilmez
  // Admin'de zaten etkin bir Havale/EFT kartı varsa (başlık veya metinde "havale"/"EFT") koddan üretileni göstermeyiz; admin'inki Havale sırasına geçer.
  const adminHavale = views.filter((v) => v.kind === "TEXT" && HAVALE_RE.test(`${v.title} ${v.text}`));
  if (adminHavale.length > 0) {
    for (const r of ranked) if (adminHavale.some((v) => v.id === r.item.id)) r.order = HAVALE_ORDER;
  } else if (ctx.maxTotalDiscountPct !== 0) {
    const pct = (Math.round(BANK_TRANSFER_DISCOUNT * 10000) / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
    ranked.push({ order: HAVALE_ORDER, item: { id: "havale", icon: ICONS.HAVALE, title: `Havale/EFT'de %${pct} indirim`, text: "Net tutar ürün sayfasında" } });
  }
  const items = ranked
    .map((r, i) => ({ ...r, i }))
    .sort((a, b) => a.order - b.order || a.i - b.i)
    .map((r) => r.item);

  return (
    <DismissibleStrip surum={surum}>
      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-4 flex-1 min-w-0">
        {items.map((it) => (
          <Cell key={it.id} item={it} />
        ))}
      </ul>
    </DismissibleStrip>
  );
}

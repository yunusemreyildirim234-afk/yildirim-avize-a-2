import Link from "next/link";
import { ArrowRight, MapPin, Tag, Truck } from "lucide-react";
import { CopyCode, DismissibleStrip } from "@/components/PromoStripClient";
import { getPromoViews } from "@/lib/promo-data";
import type { PromoTheme, PromoView } from "@/lib/promo-cards";

// Marka logosunun renk ailesi; derin tonlar (700-800) üzerinde beyaz metin ve sarıda koyu metin: WCAG AA (>= 4.5:1).
const THEMES: Record<PromoTheme, { card: string; chip: string; btn: string; link: string }> = {
  kirmizi: { card: "bg-gradient-to-br from-red-700 to-rose-900 text-white", chip: "bg-white/15 text-white", btn: "bg-white text-red-900 hover:bg-red-50", link: "text-white underline decoration-white/60" },
  turuncu: { card: "bg-gradient-to-br from-orange-700 to-amber-900 text-white", chip: "bg-white/15 text-white", btn: "bg-white text-orange-900 hover:bg-orange-50", link: "text-white underline decoration-white/60" },
  sari: { card: "bg-gradient-to-br from-amber-300 to-yellow-400 text-zinc-900", chip: "bg-zinc-900/10 text-zinc-900", btn: "bg-zinc-900 text-white hover:bg-zinc-800", link: "text-zinc-900 underline decoration-zinc-900/50" },
  yesil: { card: "bg-gradient-to-br from-emerald-700 to-green-900 text-white", chip: "bg-white/15 text-white", btn: "bg-white text-emerald-900 hover:bg-emerald-50", link: "text-white underline decoration-white/60" },
  mavi: { card: "bg-gradient-to-br from-blue-800 to-sky-900 text-white", chip: "bg-white/15 text-white", btn: "bg-white text-blue-900 hover:bg-blue-50", link: "text-white underline decoration-white/60" },
  mor: { card: "bg-gradient-to-br from-purple-800 to-violet-900 text-white", chip: "bg-white/15 text-white", btn: "bg-white text-purple-900 hover:bg-purple-50", link: "text-white underline decoration-white/60" },
};

const ICONS = { COUPON: Tag, SHIPPING: Truck, PICKUP: MapPin, TEXT: ArrowRight } as const;

function Card({ v }: { v: PromoView }) {
  const t = THEMES[v.theme];
  const Icon = ICONS[v.kind];
  const linkCls = `inline-flex items-center gap-1 min-h-11 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${t.link}`;
  return (
    <article className={`snap-start shrink-0 basis-[85%] sm:basis-auto rounded-2xl p-5 shadow-sm flex flex-col gap-3 ${t.card}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${t.chip}`}>
          <Icon aria-hidden="true" className="w-4 h-4" />
        </span>
        <h3 className="font-serif font-bold text-lg leading-tight">{v.title}</h3>
      </div>
      <p className="text-sm leading-relaxed">{v.text}</p>
      {v.code && <CopyCode code={v.code} buttonClass={t.btn} codeClass="bg-black/25 text-inherit" />}
      {v.cta &&
        (v.cta.external ? (
          <a href={v.cta.href} target="_blank" rel="noopener noreferrer" className={linkCls}>
            {v.cta.label} <ArrowRight aria-hidden="true" className="w-3.5 h-3.5" />
          </a>
        ) : (
          <Link href={v.cta.href} className={linkCls}>
            {v.cta.label}
          </Link>
        ))}
      {v.href &&
        (v.href.startsWith("/") ? (
          <Link href={v.href} className={linkCls}>
            Detaylar <ArrowRight aria-hidden="true" className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <a href={v.href} target="_blank" rel="noopener noreferrer" className={linkCls}>
            Detaylar <ArrowRight aria-hidden="true" className="w-3.5 h-3.5" />
          </a>
        ))}
    </article>
  );
}

/** Hero'nun altındaki "Avantajlar" şeridi. Sunucu bileşeni; yalnızca kopyala ve kapat düğmeleri istemci adasıdır. Görünür kart yoksa hiçbir şey çizilmez. */
export default async function PromoStrip() {
  const views = await getPromoViews();
  if (views.length === 0) return null;
  const sig = views.map((v) => `${v.id}:${v.code ?? ""}:${v.title}`).join("|");
  return (
    <DismissibleStrip sig={sig}>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1 sm:mx-0 sm:px-0 sm:overflow-visible sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {views.map((v) => (
          <Card key={v.id} v={v} />
        ))}
      </div>
    </DismissibleStrip>
  );
}

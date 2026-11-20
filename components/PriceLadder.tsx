import type { LadderStep } from "@/lib/price-ladder";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/pricing";

const tl = (n: number) => `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
// Dar ekranda ",00" atılır (yalnızca tam sayı tutarlarda); sm ve üstünde tam biçim
const tlShort = (n: number) => `${n.toLocaleString("tr-TR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })} ₺`;

/**
 * Fiyat renkleri TEK YERDE (--ya-* jetonları; açık/koyu değerleri globals.css'te). `themed` = etiket: koyu okunur metin (ink);
 * `themedAmount` = tutar: kupon, Havale ve mağaza tutarlarının hepsi sale kırmızısı (indirim rozetiyle aynı renk); mağaza satırı kalın.
 * Alt açıklama ink-muted.
 * `onDark`: açık temada bile koyu zeminli kart (zinc-900), keep-theme içinde ham ölçek kullanılır (etiket ve tutar aynı).
 * Kontrast oranları tests/price-contrast.test.mjs ile doğrulanır.
 */
export const PRICE_TONE = {
  themed: { coupon: "text-ink", bank: "text-ink", pickup: "text-ink", sale: "text-sale" },
  themedAmount: { coupon: "text-sale", bank: "text-sale", pickup: "text-sale", sale: "text-sale" },
  onDark: { coupon: "text-red-200", bank: "text-red-300", pickup: "text-red-400", sale: "text-red-400" },
} as const;
export const priceTone = (dark: boolean) => (dark ? PRICE_TONE.onDark : PRICE_TONE.themed);
const amountTone = (dark: boolean) => (dark ? PRICE_TONE.onDark : PRICE_TONE.themedAmount);

/**
 * Ana fiyatın altında adım adım düşen fiyatlar. Sunucu ve istemci bileşenlerinden kullanılabilir (durumsuz).
 * hints=false: açıklama satırları gösterilmez (sepet; etiket + tutar kalır).
 * size="card": ürün kartı; sm altında tek satır (kısa etiket solda, tutar sağda), açıklamalar gizli. "sm"/"md": her ekranda tam metin.
 */
export default function PriceLadder({ steps, size = "md", dark = false, itemsTotal, hints = true }: { steps: LadderStep[]; size?: "card" | "sm" | "md"; dark?: boolean; itemsTotal?: number; hints?: boolean }) {
  if (steps.length === 0) return null;
  // Kargo ücretsiz kuralı sepet/siparişle aynı: ürünler toplamı (indirim öncesi) >= eşik. Ücretsizse not gösterilmez.
  const showNote = !(itemsTotal !== undefined && itemsTotal >= FREE_SHIPPING_THRESHOLD);
  const card = size === "card";
  const small = size !== "md";
  const tone = priceTone(dark);
  const amount = amountTone(dark);
  return (
    <ul className={`${card ? "mt-1 space-y-0.5 sm:mt-1.5 sm:space-y-1" : small ? "mt-1.5 space-y-1" : "mt-3 space-y-1.5"} w-full`}>
      {steps.map((s) => (
        <li key={s.key} className={`flex items-baseline justify-between ${card ? "gap-1.5 sm:gap-2 text-[10px] sm:text-[11px]" : `gap-2 ${small ? "text-[11px]" : "text-xs"}`} leading-tight`}>
          <span className={`min-w-0 ${card ? "whitespace-nowrap max-sm:truncate" : ""}`}>
            <span className={`font-semibold ${tone[s.key]}`}>
              {card ? (
                <>
                  <span className="sm:hidden">{s.short}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </>
              ) : (
                s.label
              )}
            </span>
            {/* Açıklama: yalnızca dar kartta gizli; sm ve üstünde, sepette ve ürün sayfasında görünür */}
            {hints && <span className={`${card ? "hidden sm:block" : "block"} text-[10px] ${dark ? "text-zinc-500" : "text-ink-muted"}`}>{s.hint}</span>}
          </span>
          <span className={`shrink-0 whitespace-nowrap tabular-nums ${s.key === "pickup" ? "font-bold" : "font-semibold"} ${amount[s.key]} ${card ? "text-[11px] sm:text-sm" : small ? "text-sm" : "text-base"}`}>
            {card ? (
              <>
                <span className="sm:hidden">{tlShort(s.price)}</span>
                <span className="hidden sm:inline">{tl(s.price)}</span>
              </>
            ) : (
              tl(s.price)
            )}
          </span>
        </li>
      ))}
      {showNote && (
        <li className={`text-[10px] leading-tight ${dark ? "text-zinc-500" : "text-ink-muted"}`}>Fiyatlar kargo hariçtir</li>
      )}
    </ul>
  );
}

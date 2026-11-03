import type { LadderStep } from "@/lib/price-ladder";

const tl = (n: number) => `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

/** Ana fiyatın altında adım adım düşen fiyatlar. Sunucu ve istemci bileşenlerinden kullanılabilir (durumsuz). */
export default function PriceLadder({ steps, size = "md", dark = false }: { steps: LadderStep[]; size?: "sm" | "md"; dark?: boolean }) {
  if (steps.length === 0) return null;
  const sm = size === "sm";
  return (
    <ul className={`${sm ? "mt-1.5 space-y-1" : "mt-3 space-y-1.5"} w-full`}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className={`flex items-baseline justify-between gap-2 ${sm ? "text-[11px]" : "text-xs"} leading-tight`}>
            <span className="min-w-0">
              <span className={last ? (dark ? "font-semibold text-amber-300" : "font-semibold text-amber-900") : dark ? "text-zinc-300" : "text-neutral-700"}>{s.label}</span>
              <span className={`block text-[10px] ${dark ? "text-zinc-500" : "text-neutral-500"}`}>{s.hint}</span>
            </span>
            <span className={`shrink-0 tabular-nums ${last ? `font-bold ${sm ? "text-sm" : "text-base"} ${dark ? "text-amber-300" : "text-amber-900"}` : `font-semibold ${dark ? "text-zinc-200" : "text-neutral-800"}`}`}>
              {tl(s.price)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

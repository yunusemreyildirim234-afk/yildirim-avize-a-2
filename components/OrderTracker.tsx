import { Ban, Bike, Clock, Package, PackageCheck, ReceiptText, RotateCcw, Truck, type LucideIcon } from "lucide-react";
import { trackState } from "@/lib/orderStatus";

const ICONS: LucideIcon[] = [ReceiptText, Package, Truck, Bike, PackageCheck];

const fmt = (d?: string | Date | null) =>
  d
    ? new Date(d).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Istanbul",
      })
    : "";

interface Props {
  order: {
    status: string;
    shippingType?: string | null;
    kargonomiStatus?: string | null;
    kargonomiStatusLabel?: string | null;
    cancelReturnType?: string | null;
    cancelReturnStatus?: string | null;
    createdAt: string | Date;
    updatedAt?: string | Date | null;
  };
}

const TONES = {
  red: { box: "bg-red-50 border-red-200 text-red-800", Icon: Ban },
  orange: { box: "bg-orange-50 border-orange-200 text-orange-800", Icon: RotateCcw },
  amber: { box: "bg-amber-50 border-amber-200 text-amber-900", Icon: Clock },
};

/** MNG tarzı 5 adımlı yatay sipariş takip çubuğu. */
export default function OrderTracker({ order }: Props) {
  const state = trackState(order);

  if (state.kind === "special") {
    const { box, Icon } = TONES[state.tone];
    return (
      <div role="status" className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${box}`}>
        <Icon aria-hidden="true" className="w-5 h-5 shrink-0" />
        <div>
          <p className="text-sm font-bold">{state.label}</p>
          {state.hint && <p className="text-[11px] mt-0.5 opacity-80">{state.hint}</p>}
        </div>
      </div>
    );
  }

  const { current, labels } = state;
  return (
    <ol aria-label="Sipariş durumu" className="grid grid-cols-5 w-full py-2">
      {labels.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const reached = done || active;
        const Icon = ICONS[i];
        const date = i === 0 ? fmt(order.createdAt) : active ? fmt(order.updatedAt) : "";
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="relative flex flex-col items-center text-center">
            {/* Adımlar arası bağlantı çizgisi */}
            {i < labels.length - 1 && (
              <span aria-hidden="true" className="absolute top-5 left-1/2 w-full h-1 -translate-y-1/2 rounded-full bg-neutral-200 overflow-hidden">
                {done && <span className="ya-fill ya-shimmer block h-full w-full rounded-full" />}
                {active && (
                  <span
                    className="ya-fill ya-shimmer block h-full rounded-full"
                    style={{ ["--ya-fill-to" as string]: "50%", width: "50%" }}
                  />
                )}
              </span>
            )}

            <span className="relative z-10 flex items-center justify-center">
              {active && current < labels.length - 1 && (
                <span aria-hidden="true" className="ya-pulse-ring absolute inset-0 rounded-full bg-amber-400" />
              )}
              <span
                className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors duration-500 ${
                  reached
                    ? "bg-gradient-to-br from-amber-400 to-amber-600 border-amber-500 text-white shadow-md shadow-amber-500/30"
                    : "bg-neutral-100 border-neutral-200 text-neutral-400"
                }`}
              >
                <Icon aria-hidden="true" className="w-[18px] h-[18px]" />
              </span>
            </span>

            <span className={`mt-2 px-0.5 text-[10px] sm:text-[11px] leading-tight font-semibold ${reached ? "text-neutral-900" : "text-neutral-400"}`}>
              {label}
            </span>
            {date && <span className="mt-0.5 px-0.5 text-[9px] sm:text-[10px] text-neutral-500 leading-tight">{date}</span>}
          </li>
        );
      })}
    </ol>
  );
}

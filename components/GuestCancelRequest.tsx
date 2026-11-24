import Link from "next/link";
import { WHATSAPP_NUMBER } from "@/lib/site";
import { guestCancelAction, guestCancelWaLink } from "@/lib/guest-cancel-request";

// Sunucu bileşeni: yalnızca boolean (isOwner) ve durum gelir; sahibin kimliği hiçbir yerde taşınmaz.
export default function GuestCancelRequest({ code, status, isOwner, cancelReturnStatus }: { code: string; status: string; isOwner: boolean; cancelReturnStatus?: string | null }) {
  const a = guestCancelAction({ status, isOwner, cancelReturnStatus });
  if (a.kind === "none") return null;
  if (a.kind === "info") return <p data-testid="misafir-talep-bilgi" className="text-sm text-ink-muted text-center">{a.text}</p>;
  return (
    <div data-testid="misafir-talep" className="space-y-2 text-center">
      <a
        href={guestCancelWaLink(WHATSAPP_NUMBER, a.message(code))}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-6 py-3 rounded-xl transition-colors"
      >
        {a.label}
      </a>
      <p className="text-xs text-ink-muted">
        Üyeliksiz siparişlerde talepler WhatsApp veya e-posta ile alınır.{" "}
        <Link href="/iletisim" className="font-semibold text-bronze-ink underline underline-offset-2">İletişim</Link>
      </p>
    </div>
  );
}

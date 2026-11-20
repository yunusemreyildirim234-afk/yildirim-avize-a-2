import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageHref, pageItems } from "@/lib/pagination";

type Params = Record<string, string | string[] | undefined>;

/**
 * Sunucu tarafı sayfalama bağlantıları (gerçek <a>; klavye ile erişilebilir, geçerli sayfa aria-current).
 * Dar ekranda sade: Önceki / "Sayfa N / M" / Sonraki. Toplam 1 sayfaysa hiçbir şey çizilmez.
 */
export default function Pagination({
  path,
  page,
  pages,
  params,
  label = "Sayfalama",
  className = "mt-10",
}: {
  path: string;
  page: number;
  pages: number;
  params?: Params;
  label?: string;
  className?: string;
}) {
  if (pages <= 1) return null;
  const href = (n: number) => pageHref(path, n, params);
  const base = "inline-flex min-w-10 h-10 items-center justify-center rounded-lg border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-bronze-ink";
  const idle = `${base} border-line bg-raised text-ink-muted hover:border-bronze-ink hover:text-bronze-ink`;
  return (
    <nav aria-label={label} className={`${className} flex flex-nowrap sm:flex-wrap items-center justify-between sm:justify-center gap-2`}>
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={idle}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4 sm:hidden" />
          <span className="sr-only sm:not-sr-only">← Önceki</span>
        </Link>
      ) : (
        <span aria-disabled="true" className={`${base} border-line text-ink-subtle`}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4 sm:hidden" />
          <span className="sr-only sm:not-sr-only">← Önceki</span>
        </span>
      )}
      <span className="sm:hidden text-sm text-ink-muted px-2">
        Sayfa {page} / {pages}
      </span>
      {pageItems(page, pages).map((it, i) =>
        it === "gap" ? (
          <span key={`g${i}`} aria-hidden="true" className="hidden sm:inline px-1 text-ink-subtle">
            …
          </span>
        ) : it === page ? (
          <span key={it} aria-current="page" className={`${base} max-sm:hidden border-ink bg-ink text-canvas`}>
            {it}
          </span>
        ) : (
          <Link key={it} href={href(it)} aria-label={`Sayfa ${it}`} className={`${idle} max-sm:hidden`}>
            {it}
          </Link>
        )
      )}
      {page < pages ? (
        <Link href={href(page + 1)} rel="next" className={idle}>
          <ChevronRight aria-hidden="true" className="h-4 w-4 sm:hidden" />
          <span className="sr-only sm:not-sr-only">Sonraki →</span>
        </Link>
      ) : (
        <span aria-disabled="true" className={`${base} border-line text-ink-subtle`}>
          <ChevronRight aria-hidden="true" className="h-4 w-4 sm:hidden" />
          <span className="sr-only sm:not-sr-only">Sonraki →</span>
        </span>
      )}
    </nav>
  );
}

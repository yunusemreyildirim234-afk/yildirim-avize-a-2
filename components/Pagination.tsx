import Link from "next/link";
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
  const base = "inline-flex min-w-9 h-9 items-center justify-center rounded-lg border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-amber-600";
  const idle = `${base} border-zinc-200 bg-white text-zinc-700 hover:border-amber-600 hover:text-amber-800`;
  return (
    <nav aria-label={label} className={`${className} flex flex-wrap items-center justify-center gap-2`}>
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={idle}>
          ← Önceki
        </Link>
      ) : (
        <span aria-disabled="true" className={`${base} border-zinc-100 text-zinc-300`}>
          ← Önceki
        </span>
      )}
      <span className="sm:hidden text-sm text-zinc-600 px-2">
        Sayfa {page} / {pages}
      </span>
      {pageItems(page, pages).map((it, i) =>
        it === "gap" ? (
          <span key={`g${i}`} aria-hidden="true" className="hidden sm:inline px-1 text-zinc-400">
            …
          </span>
        ) : it === page ? (
          <span key={it} aria-current="page" className={`${base} hidden sm:inline-flex border-zinc-900 bg-zinc-900 text-white`}>
            {it}
          </span>
        ) : (
          <Link key={it} href={href(it)} aria-label={`Sayfa ${it}`} className={`${idle} hidden sm:inline-flex`}>
            {it}
          </Link>
        )
      )}
      {page < pages ? (
        <Link href={href(page + 1)} rel="next" className={idle}>
          Sonraki →
        </Link>
      ) : (
        <span aria-disabled="true" className={`${base} border-zinc-100 text-zinc-300`}>
          Sonraki →
        </span>
      )}
    </nav>
  );
}

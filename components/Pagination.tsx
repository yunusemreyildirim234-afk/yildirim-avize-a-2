import Link from "next/link";
import { pageHref, pageItems } from "@/lib/pagination";

/** Sunucu tarafı sayfalama bağlantıları (gerçek <a>; klavye ile erişilebilir, geçerli sayfa aria-current). */
export default function Pagination({ path, page, pages, params }: { path: string; page: number; pages: number; params?: Record<string, string | string[] | undefined> }) {
  if (pages <= 1) return null;
  const href = (n: number) => pageHref(path, n, params);
  const base = "inline-flex min-w-9 h-9 items-center justify-center rounded-lg border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-amber-600";
  const idle = `${base} border-zinc-200 bg-white text-zinc-700 hover:border-amber-600 hover:text-amber-800`;
  return (
    <nav aria-label="Sayfalama" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={idle}>
          ← Önceki
        </Link>
      ) : (
        <span aria-disabled="true" className={`${base} border-zinc-100 text-zinc-300`}>
          ← Önceki
        </span>
      )}
      {pageItems(page, pages).map((it, i) =>
        it === "gap" ? (
          <span key={`g${i}`} aria-hidden="true" className="px-1 text-zinc-400">
            …
          </span>
        ) : it === page ? (
          <span key={it} aria-current="page" className={`${base} border-zinc-900 bg-zinc-900 text-white`}>
            {it}
          </span>
        ) : (
          <Link key={it} href={href(it)} aria-label={`Sayfa ${it}`} className={idle}>
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

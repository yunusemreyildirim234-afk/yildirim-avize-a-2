import Link from "next/link";
import { adetHref, type Adet } from "@/lib/pagination";

const OPTIONS: { adet: Adet; label: string }[] = [
  { adet: "24", label: "24" },
  { adet: "48", label: "48" },
  { adet: "96", label: "96" },
  { adet: "tumu", label: "Tümü" },
];

/** "Sayfa başına" seçimi: bağlantı düğmeleri (rel=nofollow); seçili olanda aria-current="true". */
export default function PageSizeLinks({
  path,
  current,
  page,
  size,
  params,
}: {
  path: string;
  current: Adet;
  page: number;
  size: number;
  params?: Record<string, string | string[] | undefined>;
}) {
  return (
    <div className="flex items-center gap-2">
      <span id="sayfa-basina" className="text-zinc-500">
        Sayfa başına:
      </span>
      <div role="group" aria-labelledby="sayfa-basina" className="flex items-center gap-1">
        {OPTIONS.map((o) =>
          o.adet === current ? (
            <span key={o.adet} aria-current="true" className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-zinc-900 bg-zinc-900 px-2.5 font-semibold text-white">
              {o.label}
            </span>
          ) : (
            <Link
              key={o.adet}
              href={adetHref(path, o.adet, page, size, params)}
              rel="nofollow"
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white px-2.5 font-medium text-zinc-700 hover:border-amber-600 hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-amber-600"
            >
              {o.label}
            </Link>
          )
        )}
      </div>
    </div>
  );
}

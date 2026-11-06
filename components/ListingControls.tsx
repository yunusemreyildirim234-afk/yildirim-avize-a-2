"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { SORTS, SORT_LABELS, colorSwatch, type ListingFacets, type Sort } from "@/lib/listing-core";

type Fixed = Record<string, string>;

/** Form alanlarını adrese çevirir: aynı adlı alanlar virgülle birleşir (?kategori=a,b); boş değerler, varsayılan sıralama ve sayfa yazılmaz → sayfa 1'e döner. */
function urlOf(path: string, form: HTMLFormElement): string {
  const groups = new Map<string, string[]>();
  for (const [k, v] of new FormData(form)) {
    if (typeof v !== "string" || !v.trim()) continue;
    groups.set(k, [...(groups.get(k) ?? []), v.trim()]);
  }
  if (groups.get("siralama")?.[0] === "onerilen") groups.delete("siralama");
  const q = new URLSearchParams();
  for (const [k, v] of groups) q.set(k, v.join(","));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

const hiddenFields = (fixed: Fixed, adet?: string) => (
  <>
    {Object.entries(fixed).map(([k, v]) => (
      <input key={k} type="hidden" name={k} value={v} />
    ))}
    {adet && <input type="hidden" name="adet" value={adet} />}
  </>
);

const field =
  "w-full rounded-xl border border-zinc-300 bg-white text-zinc-900 text-base lg:text-sm px-3 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600";

/** Masaüstü araç çubuğundaki "Sırala" menüsü: GET formu (JS yoksa Uygula düğmesi), JS varsa seçince hemen uygulanır. Süzgeçler ve adet korunur, sayfa 1'e döner. */
export function ListingSort({ path, fixed, params, adet, current }: { path: string; fixed: Fixed; params: Record<string, string>; adet?: string; current: Sort }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { siralama: _s, ...rest } = params;
  void _s;
  return (
    <form
      method="get"
      action={path}
      className="hidden lg:flex items-center gap-2"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        start(() => router.push(urlOf(path, e.currentTarget)));
      }}
    >
      {hiddenFields({ ...fixed, ...rest }, adet)}
      <label htmlFor="siralama-ust" className="text-zinc-500">
        Sırala:
      </label>
      <select
        id="siralama-ust"
        name="siralama"
        defaultValue={current}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-8 rounded-lg border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"
      >
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {SORT_LABELS[s]}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="h-8 rounded-lg border border-zinc-300 px-2 text-xs">
          Uygula
        </button>
      </noscript>
    </form>
  );
}

/**
 * Filtre paneli: masaüstünde solda yapışkan (kutu işaretlenince hemen uygulanır; fiyat için "Uygula"), mobilde "Filtrele ve Sırala" düğmesiyle alttan açılan çekmece
 * (odak tuzağı, Esc/kapat; değişiklikler "Uygula" ile). JS kapalıyken de çalışır: düz GET formu; mobil çekmece #filtre-paneli bağlantısıyla (:target) açılır.
 */
export default function ListingFilters({
  path,
  fixed,
  params,
  adet,
  current,
  facets,
  total,
  clearHref,
  filtered,
}: {
  path: string;
  fixed: Fixed;
  params: Record<string, string>;
  adet?: string;
  current: Sort;
  facets: ListingFacets;
  total: number;
  clearHref: string;
  filtered: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(64);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLAnchorElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const selectedCats = new Set((params.kategori ?? "").split(","));
  const selectedColors = new Set((params.renk ?? "").split(","));

  // Yapışkan düğme üst menünün hemen altında dursun
  useEffect(() => {
    const h = () => setTop(document.querySelector("header")?.getBoundingClientRect().height ?? 64);
    h();
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // Çekmece açıkken: gövde kaydırması kilitli, odak çekmecede (Tab döngüsü), Esc kapatır; kapanınca odak düğmeye döner
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>('a[href], button, input:not([type="hidden"]), select')].filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    const opened = opener.current;
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", key);
      opened?.focus();
    };
  }, [open]);

  const apply = (form: HTMLFormElement) => {
    start(() => {
      router.push(urlOf(path, form));
      setOpen(false);
    });
  };
  const desktop = () => window.matchMedia("(min-width: 1024px)").matches;

  const legend = "text-xs font-semibold uppercase tracking-[0.08em] text-zinc-900 mb-2";
  const row = "flex items-center gap-3 min-h-10 lg:min-h-8 py-1 cursor-pointer text-sm text-zinc-700 hover:text-zinc-900";
  const box = "h-5 w-5 lg:h-4 lg:w-4 shrink-0 accent-amber-600";
  const nCats = facets.categories.length;

  return (
    <>
      {/* Mobil: yapışkan "Filtrele ve Sırala" düğmesi (>=44 px) */}
      <div className="lg:hidden sticky z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-white/95 border-b border-zinc-200" style={{ top }}>
        <a
          ref={opener}
          href="#filtre-paneli"
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          data-testid="filtre-ac"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-900 hover:border-amber-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filtrele ve Sırala
          {filtered && <span className="ml-1 rounded-full bg-amber-600 px-2 py-0.5 text-[11px] text-white">Aktif</span>}
        </a>
      </div>

      <div
        id="filtre-paneli"
        className={`${open ? "max-lg:fixed max-lg:inset-0 max-lg:z-[70] max-lg:flex max-lg:flex-col max-lg:justify-end" : "max-lg:hidden max-lg:target:fixed max-lg:target:inset-0 max-lg:target:z-[70] max-lg:target:flex max-lg:target:flex-col max-lg:target:justify-end"} lg:block`}
      >
        {/* Arka perde (mobil) */}
        <a href="#" onClick={(e) => {
            e.preventDefault();
            setOpen(false);
          }} aria-hidden="true" tabIndex={-1} className="lg:hidden absolute inset-0 bg-black/50" />
        <div
          ref={panel}
          role={open ? "dialog" : undefined}
          aria-modal={open ? true : undefined}
          aria-label="Filtrele ve Sırala"
          className="relative max-lg:max-h-[88vh] max-lg:overflow-y-auto max-lg:rounded-t-3xl max-lg:bg-white max-lg:p-5 max-lg:pb-24 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-2"
        >
          <div className="flex items-center justify-between lg:hidden mb-3">
            <h2 className="font-serif text-lg font-bold text-zinc-900">Filtrele ve Sırala</h2>
            <button
              ref={closeBtn}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Kapat"
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <form
            method="get"
            action={path}
            aria-busy={pending}
            onSubmit={(e) => {
              e.preventDefault();
              apply(e.currentTarget);
            }}
            onChange={(e) => {
              // Masaüstünde kutu işaretlenince hemen uygula; mobilde "Uygula" ile
              if (desktop() && e.target instanceof HTMLInputElement && e.target.type === "checkbox") e.currentTarget.requestSubmit();
            }}
            className="space-y-6"
          >
            {hiddenFields(fixed, adet)}

            <div className="lg:hidden">
              <label htmlFor="siralama-panel" className={`${legend} block`}>
                Sırala
              </label>
              <select id="siralama-panel" name="siralama" defaultValue={current} className={field}>
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            {nCats > 1 && (
              <fieldset>
                <legend className={legend}>Kategori</legend>
                <ul>
                  {facets.categories.map((c) => (
                    <li key={c.slug}>
                      <label className={row}>
                        <input type="checkbox" name="kategori" value={c.slug} defaultChecked={selectedCats.has(c.slug)} className={box} />
                        <span className="flex-1">{c.title}</span>
                        <span className="text-xs tabular-nums text-zinc-500">({c.count})</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}

            {facets.colors.length > 0 && (
              <fieldset>
                <legend className={legend}>Renk</legend>
                <ul className="max-h-72 overflow-y-auto pr-1">
                  {facets.colors.map((c) => {
                    const hex = colorSwatch(c.key);
                    return (
                      <li key={c.key}>
                        <label className={row}>
                          <input type="checkbox" name="renk" value={c.key} defaultChecked={selectedColors.has(c.key)} className={box} />
                          <span
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 rounded-full border border-zinc-300"
                            style={hex ? { backgroundColor: hex } : { backgroundImage: "linear-gradient(135deg,#fff 45%,#d4d4d8 45%,#d4d4d8 55%,#fff 55%)" }}
                          />
                          <span className="flex-1">{c.name}</span>
                          <span className="text-xs tabular-nums text-zinc-500">({c.count})</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            )}

            {facets.price && (
              <fieldset>
                <legend className={legend}>Fiyat (₺)</legend>
                <div className="flex items-center gap-2">
                  <label className="flex-1">
                    <span className="sr-only">En düşük fiyat</span>
                    <input type="number" inputMode="numeric" min={0} name="fiyat_min" defaultValue={params.fiyat_min ?? ""} placeholder={String(facets.price.min)} className={field} />
                  </label>
                  <span aria-hidden="true" className="text-zinc-400">
                    –
                  </span>
                  <label className="flex-1">
                    <span className="sr-only">En yüksek fiyat</span>
                    <input type="number" inputMode="numeric" min={0} name="fiyat_max" defaultValue={params.fiyat_max ?? ""} placeholder={String(facets.price.max)} className={field} />
                  </label>
                </div>
              </fieldset>
            )}

            <div className="flex items-center gap-3 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:border-t max-lg:border-zinc-200 max-lg:bg-white max-lg:p-4">
              <button type="submit" className="min-h-11 lg:min-h-10 flex-1 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
                Uygula{open ? ` (${total} ürün)` : ""}
              </button>
              {filtered && (
                <Link href={clearHref} onClick={() => setOpen(false)} rel="nofollow" className="inline-flex min-h-11 lg:min-h-10 items-center rounded-xl border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:border-amber-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600">
                  Temizle
                </Link>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

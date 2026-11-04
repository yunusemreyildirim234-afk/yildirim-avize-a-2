"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Home, Plus, X } from "lucide-react";
import { DEFAULT_PROMO_CARDS, MAX_CODE, MAX_HREF, MAX_PROMO_CARDS, MAX_TEXT, MAX_TITLE, PROMO_THEMES, validHref, type PromoCard, type PromoTheme } from "@/lib/promo-cards";
import { editorSelection, moveKey } from "@/lib/collections";
import { DEFAULT_COUNTS, MAX_COUNT, MAX_PINNED, SECTION_KEYS, composeSection, type ResolvedConfig, type SectionKey } from "@/lib/homepage-compose";

export interface PoolItem {
  id: string;
  title: string;
  modelCode: string | null;
}

export interface CollectionOption {
  key: string;
  title: string;
  count: number;
}

interface Props {
  initial: ResolvedConfig;
  promoCards: PromoCard[];
  collectionOptions: CollectionOption[];
  savedCollections: string[];
  pools: Record<SectionKey, PoolItem[]>;
}

const LABELS: Record<SectionKey, { title: string; hint: string }> = {
  featured: { title: "Öne Çıkan Ürünler", hint: "Sabitlenebilecek ürünler: şu an sitede öne çıkarılan ürünler." },
  discounted: { title: "İndirimli & Fırsat Ürünleri", hint: "Sabitlenebilecek ürünler: şu an indirimde olan ürünler." },
  bestsellers: { title: "Çok Satanlar", hint: "Sabitlenebilecek ürünler: Çok Satanlar listesine aday ürünler." },
};

const THEME_LABELS: Record<PromoTheme, string> = { kirmizi: "Kırmızı", turuncu: "Turuncu", sari: "Sarı", yesil: "Yeşil", mavi: "Mavi", mor: "Mor" };
const KIND_LABELS: Record<PromoCard["kind"], string> = { COUPON: "Kupon", TEXT: "Serbest metin", SHIPPING: "Ücretsiz kargo (otomatik)", PICKUP: "Mağazadan teslim (otomatik)" };

/** Açılır alt bölüm: varsayılan kapalı, başlıkta tek satırlık özet. İçerik sökülmez (grid-rows + inert), böylece alan durumu ve odak mantığı bozulmaz. */
function Sub({ id, title, summary, children }: { id: string; title: string; summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby={`${id}-h`} className="rounded-xl border border-neutral-200 bg-white">
      <button
        type="button"
        id={`${id}-h`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="w-full min-h-[52px] px-4 py-3 flex items-center justify-between gap-3 text-left rounded-xl hover:bg-neutral-50/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"
      >
        <span className="min-w-0">
          <span className="block font-bold text-neutral-900 text-sm">{title}</span>
          <span className="block text-xs text-neutral-500 truncate">{summary}</span>
        </span>
        <ChevronDown aria-hidden="true" className={`w-5 h-5 text-neutral-500 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={`${id}-panel`} className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden" inert={!open}>
          <div className="border-t border-neutral-100 p-4 space-y-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

const norm = (v?: string | null) => (v ?? "").toLocaleLowerCase("tr").trim();

interface SectionState {
  count: string;
  pinned: string[];
  reset: boolean; // kayıtta varsayılana dönecek (bölüm ayarı silinir)
}

export default function AdminHomepage({ initial, pools, promoCards, collectionOptions, savedCollections }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<Record<SectionKey, SectionState>>(() =>
    Object.fromEntries(SECTION_KEYS.map((k) => [k, { count: String(initial[k].count), pinned: initial[k].pinnedIds, reset: false }])) as Record<SectionKey, SectionState>
  );
  // Koleksiyonlar: seçili kategoriler (sıralı). Kayıt yoksa hepsi seçili görünür; değiştirilmeden kaydedilirse varsayılan davranış sürer.
  const initialSel = useMemo(() => editorSelection(collectionOptions, savedCollections), [collectionOptions, savedCollections]);
  const [colSel, setColSel] = useState<string[]>(initialSel.selected);
  const [colCustom, setColCustom] = useState(initialSel.custom); // false: varsayılan (kayıtsız)
  const [colReset, setColReset] = useState(false);
  const usable = collectionOptions.filter((c) => c.count > 0); // ürünsüz kategori seçilemez
  const colTitle = (k: string) => collectionOptions.find((c) => c.key === k)?.title ?? k;
  const changeSel = (next: string[]) => {
    setColSel(next);
    setColCustom(true);
    setColReset(false);
  };
  const resetCollections = () => {
    setColSel(usable.map((c) => c.key));
    setColCustom(false);
    setColReset(true);
  };
  const [cards, setCards] = useState<PromoCard[]>(promoCards);
  const [cardsReset, setCardsReset] = useState(false); // kayıtta varsayılan kartlara dönülecek
  const [queries, setQueries] = useState<Record<SectionKey, string>>({ featured: "", discounted: "", bestsellers: "" });

  const patch = (k: SectionKey, p: Partial<SectionState>) => setState((s) => ({ ...s, [k]: { ...s[k], reset: false, ...p } }));
  const titleOf = useMemo(() => {
    const m = new Map<string, PoolItem>();
    for (const k of SECTION_KEYS) for (const p of pools[k]) m.set(`${k}:${p.id}`, p);
    return m;
  }, [pools]);

  const countOk = (k: SectionKey) => {
    const n = Number(state[k].count);
    return Number.isInteger(n) && n >= 1 && n <= MAX_COUNT;
  };

  const resetSection = (k: SectionKey) => {
    if (!confirm(`"${LABELS[k].title}" bölümü varsayılana dönecek (sabitlenenler silinir, ilk ${DEFAULT_COUNTS[k]} ürün). Kaydedince geçerli olur. Devam edilsin mi?`)) return;
    setState((s) => ({ ...s, [k]: { count: String(DEFAULT_COUNTS[k]), pinned: [], reset: true } }));
  };

  const move = (k: SectionKey, i: number, d: -1 | 1) => {
    const list = [...state[k].pinned];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    patch(k, { pinned: list });
  };

  const patchCard = (i: number, p: Partial<PromoCard>) => {
    setCardsReset(false);
    setCards((list) => list.map((c, j) => (j === i ? { ...c, ...p } : c)));
  };
  const moveCard = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= cards.length) return;
    setCardsReset(false);
    setCards((list) => {
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const addCard = (kind: "COUPON" | "TEXT") => {
    if (cards.length >= MAX_PROMO_CARDS) return;
    setCardsReset(false);
    setCards((list) => [...list, { id: `n${Date.now().toString(36)}`, kind, title: "", text: "", ...(kind === "COUPON" ? { code: "" } : {}), theme: "turuncu", active: true }]);
  };
  const resetCards = () => {
    if (!confirm("Avantaj kartları varsayılan 3 karta (kupon, ücretsiz kargo, mağazadan teslim) dönecek; eklediğiniz kartlar silinir. Kaydedince geçerli olur. Devam edilsin mi?")) return;
    setCards(DEFAULT_PROMO_CARDS);
    setCardsReset(true);
  };
  const cardError = (): string | null => {
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const n = i + 1;
      if (c.kind === "TEXT" && !c.title.trim()) return `${n}. kart: başlık zorunludur.`;
      if (c.kind === "COUPON" && !/^[A-Za-z0-9_-]{1,30}$/.test((c.code ?? "").trim())) return `${n}. kart: kupon kodu yalnızca harf, rakam, - ve _ içerebilir.`;
      if (c.href && !validHref(c.href.trim())) return `${n}. kart: bağlantı yalnızca site içi yol (/...) veya https olabilir.`;
    }
    return null;
  };

  const save = async () => {
    const ce = cardsReset ? null : cardError();
    if (ce) return toast.error(ce);
    const bad = SECTION_KEYS.find((k) => !state[k].reset && !countOk(k));
    if (bad) return toast.error(`"${LABELS[bad].title}": ürün sayısı 1 ile ${MAX_COUNT} arasında olmalıdır.`);
    setSaving(true);
    try {
      const body: Record<string, unknown> = Object.fromEntries(SECTION_KEYS.map((k) => [k, state[k].reset ? null : { count: Number(state[k].count), pinnedIds: state[k].pinned }]));
      body.promoCards = cardsReset ? null : cards.map((c) => ({ ...c, title: c.title.trim(), text: c.text.trim(), ...(c.kind === "COUPON" ? { code: (c.code ?? "").trim() } : {}), ...(c.href ? { href: c.href.trim() } : {}) }));
      if (colCustom && colSel.length === 0) return toast.error("Koleksiyonlar: en az bir kategori seçin veya varsayılana dönün.");
      // Varsayılan (kayıtsız) durumda dokunulmamış liste gönderilmez; sıfırlama null gönderir
      if (colReset) body.collections = null;
      else if (colCustom) body.collections = colSel;
      const res = await fetch("/api/admin/homepage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi.");
      toast.success("Kaydedildi. Değişiklik sitede geçerli.");
      for (const w of (data.warnings as string[] | undefined) ?? []) toast.warning("Kupon uyarısı", { description: w, duration: 15000 });
      setCardsReset(false);
      setColReset(false);
      setState((s) => Object.fromEntries(SECTION_KEYS.map((k) => [k, { ...s[k], reset: false }])) as Record<SectionKey, SectionState>);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "p-2.5 rounded-lg border border-neutral-300 bg-white text-xs focus:outline-none focus:border-amber-600";

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full p-6 flex items-center justify-between gap-4 text-left hover:bg-neutral-50/60 transition-colors"
      >
        <div>
          <h2 className="text-lg font-serif font-bold text-neutral-900 flex items-center gap-2">
            <Home aria-hidden="true" className="w-4 h-4 text-amber-600" /> Ana Sayfayı Düzenle
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">Her bölümde kaç ürün görüneceğini seçin ve istediğiniz ürünleri başa sabitleyin.</p>
        </div>
        <ChevronDown aria-hidden="true" className={`w-5 h-5 text-neutral-500 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-neutral-100 p-6 space-y-8">
          {SECTION_KEYS.map((k) => {
            const st = state[k];
            const q = norm(queries[k]);
            const candidates = q
              ? pools[k].filter((p) => !st.pinned.includes(p.id) && (norm(p.title).includes(q) || norm(p.modelCode) === q)).slice(0, 8)
              : [];
            const n = countOk(k) ? Number(st.count) : DEFAULT_COUNTS[k];
            const preview = composeSection(pools[k], { count: n, pinnedIds: st.pinned, saved: true }).shown;
            return (
              <Sub key={k} id={`hp-${k}`} title={LABELS[k].title} summary={`ilk ${n} ürün${st.pinned.length ? `, ${st.pinned.length} sabit` : ""}`}>
                <div className="flex justify-end">
                  <button type="button" onClick={() => resetSection(k)} className="text-xs font-semibold text-amber-800 hover:underline">
                    Varsayılana dön
                  </button>
                </div>

                <label className="text-xs font-semibold text-neutral-700 block">
                  Ana sayfada ilk kaç ürün görünsün
                  <input
                    type="number"
                    min={1}
                    max={MAX_COUNT}
                    step={1}
                    value={st.count}
                    onChange={(e) => patch(k, { count: e.target.value })}
                    className={`${inputCls} block mt-1 w-28 font-normal`}
                  />
                  <span className="font-normal text-neutral-500">1-{MAX_COUNT}. Varsayılan: {DEFAULT_COUNTS[k]}. Kalanlar &quot;Daha fazla göster&quot; altında açılır.</span>
                </label>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-neutral-700">Başa sabitlenecek ürünler</p>
                  {st.pinned.length === 0 ? (
                    <p className="text-xs text-neutral-500">Sabitlenen ürün yok; doğal sıralama kullanılır.</p>
                  ) : (
                    <ol className="space-y-1">
                      {st.pinned.map((id, i) => {
                        const item = titleOf.get(`${k}:${id}`);
                        return (
                          <li key={id} className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs">
                            <span className="w-5 text-neutral-400 tabular-nums">{i + 1}.</span>
                            <span className="flex-1 min-w-0 truncate text-neutral-900">
                              {item ? `${item.modelCode ? `#${item.modelCode} ` : ""}${item.title}` : "Ürün (bu bölümün kümesinde değil — sitede gösterilmez)"}
                            </span>
                            <button type="button" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => move(k, i, -1)} className="p-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30">
                              <ChevronUp aria-hidden="true" className="w-4 h-4" />
                            </button>
                            <button type="button" aria-label="Aşağı taşı" disabled={i === st.pinned.length - 1} onClick={() => move(k, i, 1)} className="p-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30">
                              <ChevronDown aria-hidden="true" className="w-4 h-4" />
                            </button>
                            <button type="button" aria-label="Kaldır" onClick={() => patch(k, { pinned: st.pinned.filter((x) => x !== id) })} className="p-1 text-red-600 hover:text-red-700">
                              <X aria-hidden="true" className="w-4 h-4" />
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  {st.pinned.length < MAX_PINNED && (
                    <div>
                      <input
                        type="search"
                        aria-label={`${LABELS[k].title} için ürün ekle`}
                        placeholder="Ürün ekle: ürün adı veya model kodu"
                        value={queries[k]}
                        onChange={(e) => setQueries((x) => ({ ...x, [k]: e.target.value }))}
                        className={`${inputCls} w-full`}
                      />
                      <p className="text-[11px] text-neutral-500 mt-1">{LABELS[k].hint}</p>
                      {q && (
                        <ul className="mt-1 rounded-lg border border-neutral-200 divide-y divide-neutral-100 max-h-44 overflow-auto text-xs">
                          {candidates.length === 0 && <li className="px-3 py-2 text-neutral-400">Bu bölümün kümesinde eşleşen ürün yok.</li>}
                          {candidates.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  patch(k, { pinned: [...st.pinned, p.id] });
                                  setQueries((x) => ({ ...x, [k]: "" }));
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                              >
                                <span className="font-mono text-amber-700 mr-2">#{p.modelCode ?? "-"}</span>
                                <span className="font-semibold text-neutral-900">{p.title}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                  <p className="text-xs font-semibold text-neutral-700 mb-1">Ana sayfada ilk {preview.length} ürün</p>
                  {preview.length === 0 ? (
                    <p className="text-xs text-neutral-500">Bu bölümde gösterilecek ürün yok.</p>
                  ) : (
                    <ol className="list-decimal pl-5 text-xs text-neutral-700 space-y-0.5 columns-1 sm:columns-2">
                      {preview.map((p) => (
                        <li key={p.id} className="break-inside-avoid">
                          {p.title}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </Sub>
            );
          })}

          <Sub id="hp-collections" title="Aydınlatma Koleksiyonları (kategori satırı)" summary={`${colSel.length} kategori${colCustom ? "" : " (varsayılan)"}`}>
            <div className="flex justify-end">
              <button type="button" onClick={resetCollections} className="text-xs font-semibold text-amber-800 hover:underline">
                Varsayılana dön
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              {colCustom ? "Yalnızca seçili kategoriler, aşağıdaki sırayla gösterilir." : "Varsayılan: tüm kategoriler (sabit olanlar + yeni eklenenler) kendi sırasıyla gösterilir."} Ürünü olmayan kategori ana sayfada görünmez. İlk 4 kart ızgarada, kalanlar yatay kaydırmayla açılır.
            </p>
            {colSel.length > 0 && (
              <ol className="space-y-1">
                {colSel.map((k, i) => (
                  <li key={k} className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs">
                    <span className="w-5 text-neutral-400 tabular-nums">{i + 1}.</span>
                    <span className="flex-1 min-w-0 truncate text-neutral-900">{colTitle(k)}</span>
                    <button type="button" aria-label={`${colTitle(k)} yukarı taşı`} disabled={i === 0} onClick={() => changeSel(moveKey(colSel, i, -1))} className="p-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30">
                      <ChevronUp aria-hidden="true" className="w-4 h-4" />
                    </button>
                    <button type="button" aria-label={`${colTitle(k)} aşağı taşı`} disabled={i === colSel.length - 1} onClick={() => changeSel(moveKey(colSel, i, 1))} className="p-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30">
                      <ChevronDown aria-hidden="true" className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <fieldset className="grid sm:grid-cols-2 gap-1">
              <legend className="text-xs font-semibold text-neutral-700 mb-1">Gösterilecek kategoriler</legend>
              {usable.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-xs text-neutral-800">
                  <input type="checkbox" checked={colSel.includes(c.key)} onChange={(e) => changeSel(e.target.checked ? [...colSel, c.key] : colSel.filter((x) => x !== c.key))} />
                  {c.title} <span className="text-neutral-400">({c.count} ürün)</span>
                </label>
              ))}
            </fieldset>
          </Sub>

          <Sub id="hp-promo" title="Avantaj kartları (ana sayfada Hero altı)" summary={`${cards.length} kart${cards.some((c) => !c.active) ? `, ${cards.filter((c) => !c.active).length} pasif` : ""}`}>
            <div className="flex justify-end">
              <button type="button" onClick={resetCards} className="text-xs font-semibold text-amber-800 hover:underline">
                Varsayılan kartlara dön
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              En fazla {MAX_PROMO_CARDS} kart. Kupon kartı, kod geçerli değilse (pasif, süresi geçmiş, limiti dolu) veya toplam indirim üst sınırı 0 ise sitede otomatik gizlenir. Otomatik kartlarda başlık/metin boşsa güncel tutar ve oranlar kullanılır.
            </p>
            {cards.length === 0 && <p className="text-xs text-neutral-500">Kart yok: ana sayfada Avantajlar bölümü görünmez.</p>}
            <ol className="space-y-3">
              {cards.map((c, i) => (
                <li key={c.id} className="rounded-xl border border-neutral-200 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="w-5 text-neutral-400 tabular-nums">{i + 1}.</span>
                    <span className="font-semibold text-neutral-800">{KIND_LABELS[c.kind]}</span>
                    <label className="flex items-center gap-1.5 ml-auto">
                      <input type="checkbox" checked={c.active} onChange={(e) => patchCard(i, { active: e.target.checked })} />
                      Etkin
                    </label>
                    <button type="button" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => moveCard(i, -1)} className="p-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30">
                      <ChevronUp aria-hidden="true" className="w-4 h-4" />
                    </button>
                    <button type="button" aria-label="Aşağı taşı" disabled={i === cards.length - 1} onClick={() => moveCard(i, 1)} className="p-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30">
                      <ChevronDown aria-hidden="true" className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Kartı sil"
                      onClick={() => {
                        setCardsReset(false);
                        setCards((list) => list.filter((_, j) => j !== i));
                      }}
                      className="p-1 text-red-600 hover:text-red-700"
                    >
                      <X aria-hidden="true" className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <label className="text-xs font-semibold text-neutral-700">
                      Başlık{c.kind === "TEXT" ? " (zorunlu)" : " (boş: otomatik)"}
                      <input value={c.title} maxLength={MAX_TITLE} onChange={(e) => patchCard(i, { title: e.target.value })} className={`${inputCls} block w-full mt-1 font-normal`} />
                    </label>
                    {c.kind === "COUPON" && (
                      <label className="text-xs font-semibold text-neutral-700">
                        Kupon kodu
                        <input
                          value={c.code ?? ""}
                          maxLength={MAX_CODE}
                          onChange={(e) => patchCard(i, { code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })}
                          className={`${inputCls} block w-full mt-1 font-mono font-normal`}
                        />
                      </label>
                    )}
                    <label className="text-xs font-semibold text-neutral-700 sm:col-span-2">
                      Metin{c.kind === "TEXT" ? "" : " (boş: otomatik)"}
                      <textarea value={c.text} maxLength={MAX_TEXT} rows={2} onChange={(e) => patchCard(i, { text: e.target.value })} className={`${inputCls} block w-full mt-1 font-normal`} />
                      <span className="font-normal text-neutral-500">{c.text.length}/{MAX_TEXT}</span>
                    </label>
                    <label className="text-xs font-semibold text-neutral-700">
                      Renk teması
                      <select value={c.theme} onChange={(e) => patchCard(i, { theme: e.target.value as PromoTheme })} className={`${inputCls} block w-full mt-1 font-normal`}>
                        {PROMO_THEMES.map((t) => (
                          <option key={t} value={t}>
                            {THEME_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-neutral-700">
                      Bağlantı (isteğe bağlı: /yol veya https://...)
                      <input value={c.href ?? ""} maxLength={MAX_HREF} onChange={(e) => patchCard(i, { href: e.target.value })} className={`${inputCls} block w-full mt-1 font-normal`} />
                    </label>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={cards.length >= MAX_PROMO_CARDS} onClick={() => addCard("COUPON")} className="inline-flex items-center gap-1 text-xs font-semibold border border-neutral-300 hover:bg-neutral-50 disabled:opacity-40 px-3 py-2 rounded-lg">
                <Plus aria-hidden="true" className="w-3.5 h-3.5" /> Kupon kartı ekle
              </button>
              <button type="button" disabled={cards.length >= MAX_PROMO_CARDS} onClick={() => addCard("TEXT")} className="inline-flex items-center gap-1 text-xs font-semibold border border-neutral-300 hover:bg-neutral-50 disabled:opacity-40 px-3 py-2 rounded-lg">
                <Plus aria-hidden="true" className="w-3.5 h-3.5" /> Metin kartı ekle
              </button>
            </div>
          </Sub>

          <div className="flex items-center gap-3">
            <button type="button" onClick={save} disabled={saving} className="bg-neutral-900 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <span className="text-[11px] text-neutral-500">Kaydedince ana sayfada hemen geçerli olur.</span>
          </div>
        </div>
      )}
    </div>
  );
}

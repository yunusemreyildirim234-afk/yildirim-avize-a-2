"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { subscribeSummary, refreshSummary } from "@/lib/notification-poll";
import { summaryChanged, type NotificationSummary } from "@/lib/notification-summary";
import { resolveLinkAction } from "@/lib/toast-link";
import { goToHash } from "@/components/ToastLinkRouter";
import { Bell, CheckCheck, Package, Sparkles, Ticket, MessageSquare, Trash2, TrendingDown } from "lucide-react";

interface Item {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const ICONS: Record<string, typeof Bell> = { ORDER: Package, COUPON: Ticket, QUESTION: MessageSquare, SYSTEM: Sparkles, PRICE_DROP: TrendingDown };

const fmt = (d: string) =>
  new Date(d).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function NotificationBell() {
  const pathname = usePathname();
  const router = useRouter();
  const seen = useRef<Set<string>>(new Set());
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [askClear, setAskClear] = useState(false); // "Tümünü Temizle" için panel içi onay
  const ref = useRef<HTMLDivElement>(null);

  const scopeQs = pathname?.startsWith("/admin") ? "?scope=admin" : "?scope=user";

  // since: yeni düşen bildirimler için toast'ın başlangıç tarihi (ISO); null ise (zil açılışı) toast gösterilmez
  const loadList = useCallback(
    (since: string | null) => {
      fetch(`/api/notifications${scopeQs}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          const list: Item[] = d.items;
          setItems(list);
          setUnread(d.unread);
          for (const n of list) {
            const fresh = since !== null && !n.read && n.createdAt > since && !seen.current.has(n.id);
            seen.current.add(n.id);
            if (!fresh) continue;
            const go = () => {
              const a = resolveLinkAction(window.location.pathname, n.link);
              if (a.kind === "navigate") router.push(a.href);
              else if (a.kind === "hash") goToHash(a.hash);
              fetch(`/api/notifications${scopeQs}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }) }).catch(() => {});
            };
            toast.info(
              <div onClick={go} className={n.link ? "cursor-pointer" : ""}>
                <div className="font-semibold">{n.title}</div>
                <div className="text-xs opacity-80">{n.message}</div>
              </div>,
              { duration: 12000, ...(n.link ? { action: { label: "Aç", onClick: go } } : {}) }
            );
          }
        })
        .catch(() => {});
    },
    [router, scopeQs]
  );

  // Özet adresi: yönetimde zil ile AdminLiveAlerts AYNI adresi dinler (tek istek, tek 180 sn zamanlayıcı); müşteride zamanlayıcı yok.
  const summaryUrl = `/api/notifications${scopeQs}&ozet=1`;
  const isAdminScope = scopeQs.endsWith("admin");
  const known = useRef<NotificationSummary | null>(null);
  const openRef = useRef(false);
  openRef.current = open;

  useEffect(() => {
    return subscribeSummary(
      summaryUrl,
      (s) => {
        const prev = known.current;
        known.current = s;
        setUnread(s.unread);
        if (!prev) return; // ilk özet: yalnız rozet; liste zil açılınca gelir
        const ch = summaryChanged(prev, s);
        if (ch.newItems) loadList(prev.latest ?? "");
        else if (ch.badge && openRef.current) loadList(null);
      },
      isAdminScope ? 180_000 : 0
    );
  }, [summaryUrl, isAdminScope, loadList]);

  // Sayfa geçişinde özet bir kez yenilenir (ilk açılış aboneliğin kendi isteğiyle gelir)
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    refreshSummary(summaryUrl);
  }, [pathname, summaryUrl]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const post = (body: object) =>
    fetch(`/api/notifications${scopeQs}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});

  const readAll = async () => {
    setItems((l) => l.map((n) => ({ ...n, read: true })));
    setUnread(0);
    await post({ all: true });
  };

  const clearAll = async () => {
    const previous = { items, unread };
    setAskClear(false);
    setItems([]);
    setUnread(0);
    try {
      const res = await fetch(`/api/notifications${scopeQs}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setItems(previous.items);
      setUnread(previous.unread);
      toast.error("Bildirimler temizlenemedi. Lütfen tekrar deneyin.");
    }
  };

  const readOne = (n: Item) => {
    setOpen(false);
    if (n.read) return;
    setItems((l) => l.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    post({ id: n.id });
  };

  return (
    <div ref={ref} className="md:relative">
      <button
        type="button"
        aria-label={`Bildirimler${unread ? `, ${unread} okunmamış` : ""}`}
        aria-expanded={open}
        onClick={() => {
          if (!open) loadList(null);
          setOpen((o) => !o);
        }}
        className="relative rounded-full p-2 sm:p-2.5 hover:bg-zinc-100 transition-colors"
      >
        <Bell aria-hidden="true" className="w-5 h-5 text-zinc-800" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-600 text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Bildirimler"
          className="bell-panel fixed left-2 right-2 top-[4.25rem] md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-96 bg-white rounded-2xl border border-zinc-200 shadow-xl overflow-hidden z-[70]"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <h2 className="text-sm font-bold text-zinc-900">Bildirimler</h2>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button type="button" onClick={readAll} className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline">
                  <CheckCheck aria-hidden="true" className="w-3.5 h-3.5" /> Tümünü Okundu İşaretle
                </button>
              )}
            </div>
          </div>
          {items.length === 0 ? (
            <p className="p-8 text-center text-xs text-zinc-400">Henüz bildiriminiz yok.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-zinc-100">
              {items.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                const body = (
                  <>
                    <span className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${n.read ? "bg-zinc-100 text-zinc-400" : "bg-amber-100 text-amber-700"}`}>
                      <Icon aria-hidden="true" className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-xs ${n.read ? "font-medium text-zinc-700" : "font-bold text-zinc-900"}`}>{n.title}</span>
                      <span className="block text-[11px] text-zinc-500 mt-0.5 break-words">{n.message}</span>
                      <span className="block text-[10px] text-zinc-400 mt-1">{fmt(n.createdAt)}</span>
                    </span>
                    {!n.read && <span aria-hidden="true" className="mt-1.5 w-2 h-2 rounded-full bg-orange-600 shrink-0" />}
                  </>
                );
                const cls = "flex items-start gap-3 px-4 py-3 hover:bg-amber-50/50 transition-colors text-left w-full";
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={(e) => {
                          readOne(n);
                          // Aynı sayfadaki #bölüm bağlantısı: Next hashchange tetiklemez; bölümü biz açtırırız
                          const a = resolveLinkAction(pathname, n.link);
                          if (a.kind === "hash") {
                            e.preventDefault();
                            goToHash(a.hash);
                          } else if (a.kind === "none") e.preventDefault();
                        }}
                        className={cls}
                      >
                        {body}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => readOne(n)} className={cls}>
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {items.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-100 px-4 py-2.5 text-[11px]">
              {askClear ? (
                <>
                  <span className="font-semibold text-zinc-800">Tüm bildirimler silinsin mi?</span>
                  <button type="button" onClick={() => setAskClear(false)} className="font-semibold text-zinc-600 hover:underline">Vazgeç</button>
                  <button type="button" onClick={clearAll} className="inline-flex items-center gap-1 rounded-md bg-red-700 px-2.5 py-1 font-bold text-white hover:bg-red-800">
                    <Trash2 aria-hidden="true" className="w-3.5 h-3.5" /> Evet, temizle
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setAskClear(true)} className="inline-flex items-center gap-1 font-semibold text-zinc-500 hover:text-red-700 hover:underline">
                  <Trash2 aria-hidden="true" className="w-3.5 h-3.5" /> Tümünü Temizle
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// İstemci: bildirim özeti için TEK yoklama kanalı. Aynı adresi dinleyen bileşenler (zil + yönetim canlı uyarısı) tek istek ve tek zamanlayıcı paylaşır.
// Zamanlayıcı yalnız en az bir dinleyici aralık istediyse çalışır; sekme gizliyken istek atılmaz, görünür olunca bir kez çekilir.
import type { NotificationSummary } from "@/lib/notification-summary";

type Listener = (s: NotificationSummary) => void;
interface Channel {
  url: string;
  subs: Map<Listener, number>; // dinleyici -> istenen aralık (ms, 0 = zamanlayıcısız)
  last: NotificationSummary | null;
  timer: ReturnType<typeof setInterval> | null;
}

const channels = new Map<string, Channel>();
let visibilityBound = false;

async function fetchOnce(ch: Channel) {
  if (typeof document !== "undefined" && document.hidden) return;
  try {
    const res = await fetch(ch.url, { cache: "no-store" });
    if (!res.ok) return;
    const data: NotificationSummary = await res.json();
    ch.last = data;
    for (const f of [...ch.subs.keys()]) f(data);
  } catch {
    /* ağ hatası: sonraki turda yeniden denenir */
  }
}

function syncTimer(ch: Channel) {
  const intervals = [...ch.subs.values()].filter((v) => v > 0);
  const want = intervals.length ? Math.min(...intervals) : 0;
  if (ch.timer) {
    clearInterval(ch.timer);
    ch.timer = null;
  }
  if (want > 0) ch.timer = setInterval(() => void fetchOnce(ch), want);
}

function bindVisibility() {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) for (const ch of channels.values()) void fetchOnce(ch);
  });
}

/** Özet adresini dinler; ilk dinleyici ilk isteği tetikler, sonrakiler son bilinen değeri hemen alır. Dönen işlev aboneliği bırakır. */
export function subscribeSummary(url: string, listener: Listener, intervalMs = 0): () => void {
  bindVisibility();
  let ch = channels.get(url);
  if (!ch) {
    ch = { url, subs: new Map(), last: null, timer: null };
    channels.set(url, ch);
  }
  ch.subs.set(listener, intervalMs);
  syncTimer(ch);
  if (ch.last) listener(ch.last);
  else if (ch.subs.size === 1) void fetchOnce(ch);
  const channel = ch;
  return () => {
    channel.subs.delete(listener);
    if (channel.subs.size === 0) {
      if (channel.timer) clearInterval(channel.timer);
      channels.delete(url);
    } else syncTimer(channel);
  };
}

/** Sayfa geçişi gibi durumlarda özeti hemen yeniler (dinleyen yoksa bir şey yapmaz). */
export function refreshSummary(url: string): void {
  const ch = channels.get(url);
  if (ch) void fetchOnce(ch);
}

// Yönetici panelinde "sakin kalınca tek uzlaştırma yenilemesi" (CMP-02).
// Yerel yamadan sonra her işlemde router.refresh() çağırmak yerine: son işlemden IDLE_MS sonra, en geç MAX_MS içinde TEK yenileme.
// Sekme gizliyse yenileme ertelenir, görünür olunca yapılır. Saf zamanlayıcı mantığı; paket yok.

export const ADMIN_REFRESH_IDLE_MS = 4000;
export const ADMIN_REFRESH_MAX_MS = 20000;

type Timer = ReturnType<typeof setTimeout>;

export interface RefreshSchedulerDeps {
  refresh: () => void;
  idleMs?: number;
  maxMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => Timer;
  clearTimer?: (t: Timer) => void;
  isHidden?: () => boolean;
}

export function createRefreshScheduler(deps: RefreshSchedulerDeps) {
  const idleMs = deps.idleMs ?? ADMIN_REFRESH_IDLE_MS;
  const maxMs = deps.maxMs ?? ADMIN_REFRESH_MAX_MS;
  const now = deps.now ?? Date.now;
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((t) => clearTimeout(t));
  const isHidden = deps.isHidden ?? (() => false);

  let pending = false; // yenileme bekliyor
  let firstAt = 0; // bekleyen serinin ilk çağrı zamanı (maxMs buradan sayılır)
  let timer: Timer | null = null;

  const stopTimer = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  const run = () => {
    stopTimer();
    if (!pending) return;
    pending = false;
    deps.refresh();
  };
  const onTimer = () => {
    timer = null;
    if (!pending) return;
    if (isHidden()) return; // görünür olunca onVisible() yapar
    run();
  };

  return {
    /** Sakin kalınca tek yenileme iste (art arda çağrılar sayacı sıfırlar; en geç maxMs). */
    schedule() {
      const t = now();
      if (!pending) {
        pending = true;
        firstAt = t;
      }
      stopTimer();
      timer = setTimer(onTimer, Math.max(0, Math.min(idleMs, firstAt + maxMs - t)));
    },
    /** Bekleyen varsa hemen yenile; yoksa hiçbir şey yapmaz. */
    flush() {
      run();
    },
    /** Bekleyeni iptal edip her durumda hemen yenile (silme, toplu işlem, 409). */
    refreshNow() {
      pending = true;
      run();
    },
    /** Sekme görünür oldu: bekleyen varsa yenile. */
    onVisible() {
      if (pending && !isHidden()) run();
    },
    get pending() {
      return pending;
    },
  };
}

// --- Tarayıcı tekil örneği (en son çağıran router kullanılır) ---
interface RouterLike {
  refresh: () => void;
}
let latest: RouterLike | null = null;
let shared: ReturnType<typeof createRefreshScheduler> | null = null;

function getShared() {
  if (!shared) {
    shared = createRefreshScheduler({
      refresh: () => latest?.refresh(),
      isHidden: () => typeof document !== "undefined" && document.visibilityState === "hidden",
    });
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => shared?.onVisible());
  }
  return shared;
}

/** Yerel yamadan sonra: sakin kalınca tek yenileme (4 sn, en geç 20 sn). */
export function scheduleAdminRefresh(router: RouterLike) {
  latest = router;
  getShared().schedule();
}

/** Anında yenile ve bekleyeni iptal et (silme, toplu işlem, model kodu, 409). */
export function refreshAdminNow(router: RouterLike) {
  latest = router;
  getShared().refreshNow();
}

/** Bekleyen uzlaştırma varsa hemen yap. */
export function flushAdminRefresh() {
  getShared().flush();
}

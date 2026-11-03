// GTM istemci çalışma zamanı. NEXT_PUBLIC_GTM_ID yoksa/geçersizse hiçbir şey yapılmaz. Çerez çubuğunun kaydı OKUNUR (çubuğa dokunulmaz).
import { isAdminPath, isGtmId, type GtmEventPayload } from "@/lib/gtm-events";

export const GTM_ID = isGtmId(process.env.NEXT_PUBLIC_GTM_ID) ? process.env.NEXT_PUBLIC_GTM_ID : "";
/** components/CookieBanner.tsx'in yazdığı anahtar: "accepted" | "rejected" (çubuk ayrı reklam/analitik kategorisi sunmaz; kabul = hepsine izin). */
export const CONSENT_KEY = "ya-cerez-onayi";

type Consent = "accepted" | "rejected" | null;
type W = Window & { dataLayer?: unknown[] };

export function readConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "accepted" || v === "rejected" ? v : null;
  } catch {
    return null;
  }
}

/** Olay gönderilebilir mi: GTM tanımlı, yönetici sayfası değil, kullanıcı reddetmemiş (karar yoksa dataLayer'da bekler; GTM yalnızca kabulden sonra yüklenir). */
export function gtmEnabled(): boolean {
  return Boolean(GTM_ID) && typeof window !== "undefined" && !isAdminPath(window.location.pathname) && readConsent() !== "rejected";
}

export function gtmPush(payload: GtmEventPayload): boolean {
  try {
    if (!gtmEnabled()) return false;
    const w = window as W;
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ ecommerce: null }, payload); // GA4: önceki e-ticaret nesnesi temizlenir
    return true;
  } catch {
    return false; // ölçüm hiçbir akışı bozmaz
  }
}

// ---- Yükleyici (GoogleTagManager bileşeni kullanır) ----
let inited = false;
let loaded = false;

// GTM, gtag komutlarını `arguments` nesnesi olarak bekler (düz dizi komut sayılmaz)
function gtag(..._args: unknown[]) {
  void _args;
  const w = window as W;
  w.dataLayer = w.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params -- GTM yalnızca Arguments nesnesini komut olarak işler
  w.dataLayer.push(arguments);
}

const KEYS = ["analytics_storage", "ad_storage", "ad_user_data", "ad_personalization"] as const;
const allAs = (v: "granted" | "denied") => Object.fromEntries(KEYS.map((k) => [k, v]));

/** Consent Mode v2: varsayılan HEPSİ reddedilmiş; GTM'den önce çağrılır. */
export function initConsent() {
  if (inited) return;
  inited = true;
  gtag("consent", "default", { ...allAs("denied"), wait_for_update: 500 });
}

export function applyConsent(c: Consent) {
  if (!GTM_ID) return;
  initConsent();
  if (c === "accepted") {
    gtag("consent", "update", allAs("granted"));
    if (!loaded) {
      loaded = true;
      const w = window as W;
      (w.dataLayer = w.dataLayer || []).push({ "gtm.start": Date.now(), event: "gtm.js" });
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
      document.head.appendChild(s);
    }
  } else if (loaded) {
    gtag("consent", "update", allAs("denied"));
  }
}

/** Yönetici sayfasına geçildiyse (yüklenmişse) izinleri geri çeker; olay göndermeyi gtmEnabled zaten keser. */
export function revokeForAdmin() {
  if (loaded) gtag("consent", "update", allAs("denied"));
}
